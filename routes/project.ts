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
        this.router.put("/:projectId", [userAuth], this.updateProject)
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
                projects = await this.prisma.project.findMany({
                    where: {
                        assignments: {
                            some: {
                                userId: req.user?.id
                            }
                        }
                    }
                })
            } else {
                projects = await this.prisma.project.findMany({})
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
            const userId = req?.body?.userId as string;
            const deadline = req?.body?.deadline as Date;

            const projectExist = await this.prisma.project.findFirst({
                where: {
                    id: projectId
                }
            })

            if (!projectExist) {
                return res.status(400).json({ message: "Project not found!" })
            }

            const alreadyAssigned = await this.prisma.assignedProject.findFirst({
                where: {
                    projectId,
                    userId, 
                    
                }
            })

            if (alreadyAssigned) {
                return res.status(400).json({ message: "This user have been assigned to this project already!" })
            }


            await this.prisma.assignedProject.create({
                data: {
                    projectId,
                    userId,
                    assignedById: req.user?.id,
                    deadline
                }
            })

            await this.prisma.notification.create({
                data: {
                    userId: req?.user?.id,
                    type: notification_type.assigned_to_project,
                    message: `You just got assigned project:${projectExist.name}`
                }
            })

            return res.status(201).json({ message: "Assigned successfully!" })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    updateProject = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const projectId = req.params?.projectId;
           const updatedProject =  await this.prisma.project.update({
                where: {
                    id: projectId,
                },
                data: {
                    ...req?.body as Project
                }
            })
            return res.status(200).json({
                result:updatedProject, 
                message: "Updated successfully!"
            })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

}

