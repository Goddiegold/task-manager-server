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
                    where: { userId: req.user?.id },
                    include: {
                        assignedBy: { select: { name: true } },
                        project: { select: { id: true, name: true, details: true } }
                    }
                })
            } else {
                projects = await this.prisma.project.findMany({
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
                where: {
                    role: user_role.team,
                    id: { in: usersId },
                    assignedProjects: {
                        none: {
                            projectId
                        }
                    },
                }
            })

            if (validUsers?.length > 0) {
                await Promise.all([
                    await this.prisma.assignedProject.createMany({
                        data: validUsers.map(item => ({ userId: item.id, deadline, assignedById: req?.user?.id, projectId }))
                    }),
                    await this.prisma.notification.createMany({
                        data: validUsers.map(item => ({
                            userId: item.id,
                            type: notification_type.assigned_to_project,
                            message: `You just got assigned project:${projectExist.name}`
                        }))
                    })
                ])
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

}

