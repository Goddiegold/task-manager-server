import { notification_type, PrismaClient, Project, user_role } from '@prisma/client';
import { Response, Router, Request } from 'express';
import {
    errorMessage
} from '../app/utils/helpers';
import {
    AuthenticatedRequest,
    IControllerBase
} from '../app/utils/types';
import { authorizeWithRBAC, userAuth } from '../app/middlewares';
import { Socket } from 'socket.io';
import sendEmail from '../app/service/mailService';


export default class ProjectRoute implements IControllerBase {

    public path = 'projects'
    public router = Router()

    constructor(private prisma: PrismaClient) {
        this.initRoutes()
    }

    public initRoutes(): void {
        this.router.post('/create', [userAuth, authorizeWithRBAC([user_role.admin])], this.createProject)
        this.router.get("/all", [userAuth], this.getProjects)
        this.router.delete("/:projectId", [userAuth], this.deleteProject)
        this.router.post("/assign/:projectId", [userAuth, authorizeWithRBAC([user_role.admin])], this.assignProject)
        this.router.put("/:projectId", [userAuth, authorizeWithRBAC([user_role.admin])], this.updateProject)
        this.router.get("/update-status/:projectId", [userAuth, authorizeWithRBAC([user_role.team])], this.updateProjectStatus)
        this.router.get("/updates/:projectId", [userAuth, authorizeWithRBAC([user_role.admin])], this.getProjectUpdates)
    }

    createProject = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const projectExist = await this.prisma.project.findFirst({
                where: {
                    name: req?.body?.name
                }
            })

            if (projectExist) {
                return res.status(400).json({ message: "Project with the given name already exist!" })
            }

            const project = await this.prisma.project.create({
                data: {
                    ...req?.body,
                    authorId: req?.user?.id
                }
            })

            return res.status(201).json({ result: project })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    getProjects = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const isAdmin = req?.user?.role === user_role.admin;
            let projects = [];

            if (!isAdmin) {
                // projects = await this.prisma.project.findMany({
                //     where: {
                //         assignments: {
                //             some: {
                //                 userId: req.user?.id
                //             }
                //         }
                //     }
                // })
                projects = await this.prisma.assignedProject.findMany({
                    orderBy: { createdAt: "desc" },
                    where: { userId: req.user?.id },
                    include: {
                        assignedBy: { select: { name: true } },
                        project: { select: { id: true, name: true, details: true } }
                    }
                })
            } else {
                projects = await this.prisma.project.findMany({
                    orderBy: { createdAt: "desc" },
                    include: { assignments: { select: { userId: true } } }
                })
            }


            return res.status(200).json({ result: projects })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    deleteProject = async (req: Request, res: Response) => {
        try {
            const projectId = req.params?.projectId
            await this.prisma.project.delete({
                where: {
                    id: projectId
                }
            })
            return res.status(200).json({ message: "Deleted project successfully!" })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    assignProject = async (req: AuthenticatedRequest, res: Response) => {
        try {
            //@ts-ignore
            const socketIOserverInstance = global?.socketIOServer as Socket | null
            const projectId = req.params?.projectId as string;
            const usersId = req?.body?.usersId as string[];
            const deadline = req?.body?.deadline || new Date() as Date;

            const projectExist = await this.prisma.project.findFirst({
                where: {
                    id: projectId
                }
            })

            if (!projectExist) {
                return res.status(400).json({ message: "Project not found!" })
            }

            const validUsers = await this.prisma.user.findMany({
                select: {
                    id: true,
                    socketId: true,
                    email: true,
                    name: true
                },
                where: {
                    role: user_role.team,
                    id: { in: usersId },
                    // assignedProjects: {
                    //     none: {
                    //         projectId
                    //     }
                    // },
                }
            })

            if (validUsers?.length > 0) {
                await Promise.all([
                    await this.prisma.assignedProject.deleteMany({
                        where: {
                            projectId,
                            userId: {
                                in: usersId
                            }
                        }
                    }),
                    await this.prisma.assignedProject.createMany({
                        data: validUsers.map(item => ({ userId: item.id, deadline, assignedById: req?.user?.id, projectId }))
                    }),
                    await this.prisma.notification.createMany({
                        data: validUsers.map(item => ({
                            userId: item.id,
                            type: notification_type.assigned_to_project,
                            projectId,
                            message: `You just got assigned project:${projectExist.name}`
                        }))
                    }),
                    await this.prisma.notification.deleteMany({
                        where: {
                            projectId,
                            userId: {
                                in: usersId
                            }
                        }
                    })
                ])

                for (const user of validUsers) {
                    if (!!socketIOserverInstance) {
                        if (!user.socketId) return;
                        socketIOserverInstance.to(user.socketId).emit("message", {
                            message: "You just got assigned a new project!",
                            type: notification_type.assigned_to_project,
                        });
                    }

                    sendEmail({
                        template: "project-assigned",
                        email: user.email,
                        subject: "Project assigned to you",
                        name: user.name,
                        projectName: projectExist.name,
                        url: `${process.env.FRONTEND_URL}/pages/login`,
                        assignedBy: req?.user?.name
                    })
                }
                return res.status(200).json({ message: "Assigned successfully!" })
            } else {
                return res.status(400).json({ message: "User(s) have been assigned to this project or they exist on the platform!" })
            }

        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    updateProject = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const projectId = req.params?.projectId;
            const updatedProject = await this.prisma.project.update({
                where: {
                    id: projectId,
                },
                data: {
                    ...req?.body as Project
                }
            })
            return res.status(200).json({
                result: updatedProject,
                message: "Updated successfully!"
            })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    updateProjectStatus = async (req: AuthenticatedRequest, res: Response) => {
        try {
            //@ts-ignore
            const socketIOserverInstance = global?.socketIOServer as Socket | null
            const projectId = req.params?.projectId as string;

            const projectAssigned = await this.prisma.assignedProject.findFirst({
                where: {
                    projectId,
                    userId: req?.user?.id
                }
            })

            if (!projectAssigned)
                return res.status(404).json({ message: "You weren't assigned this project!" })


            const updatedAsssignedProject = await this.prisma.assignedProject.update({
                include: {
                    assignedBy: {
                        select: { socketId: true, name: true, email: true }
                    },
                    project: {
                        select: { name: true }
                    }
                },
                where: { id: projectAssigned.id },
                data: { completed: true }
            })

            const assignedBy = updatedAsssignedProject.assignedBy
            if (socketIOserverInstance && assignedBy.socketId) {
                socketIOserverInstance.to(assignedBy.socketId).emit("message", {
                    message: `${req.user?.name} have updated the status of project - ${updatedAsssignedProject.project.name}!`
                })
            }

            sendEmail({
                template: "project-update",
                email: assignedBy.email,
                subject: "Update on the project you assigned",
                name: assignedBy.name,
                projectName: updatedAsssignedProject.project.name,
                url: `${process.env.FRONTEND_URL}/pages/login`,
                teamMember: req?.user?.name
            })

            return res.status(200).json({
                message: "Updated project status successfully!"
            })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    getProjectUpdates = async (req: Request, res: Response) => {
        try {
            const projectId = req.params?.projectId as string;
            const result = await this.prisma.assignedProject.findMany({
                include: {
                    user: { select: { name: true, email: true } },
                    assignedBy: { select: { name: true } }
                },
                where: { projectId }
            })
            return res.status(200).json({ result })
        } catch (error) {
            return res.status(500).json(errorMessage(error))

        }
    }

}

