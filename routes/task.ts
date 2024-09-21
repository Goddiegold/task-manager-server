
import { notification_type, PrismaClient, user_role } from '@prisma/client';
import { Response, Router, Request } from 'express';
import {
    errorMessage
} from '../app/utils/helpers';
import {
    AuthenticatedRequest,
    IControllerBase
} from '../app/utils/types';
import { authorizeWithRBAC, userAuth } from '../app/middlewares';


export default class TaskRoute implements IControllerBase {

    public path = 'tasks'
    public router = Router()

    constructor(private prisma: PrismaClient) {
        this.initRoutes()
    }

    public initRoutes(): void {
        this.router.post('/create', [userAuth, authorizeWithRBAC([user_role.admin])], this.createTask)
        this.router.get("/all", [userAuth], this.getTasks)
        this.router.delete("/:taskId", [userAuth], this.deleteTask)
        this.router.post("/assign/:taskId", [userAuth, authorizeWithRBAC([user_role.admin])], this.assignTask)
        this.router.put("/:taskId", [userAuth], this.updateTask)
    }

    createTask = async (req: AuthenticatedRequest, res: Response) => {
        try {

            const taskPayload = req?.body;
            // const users = (req?.body?.users || []) as string[]
            const taskExist = await this.prisma.project.findFirst({
                where: {
                    name: req?.body?.name
                }
            })

            if (taskExist) {
                return res.status(400).json({ message: "Task with the given name already exist!" })
            }

            const task = await this.prisma.task.create({
                data: {
                    ...taskPayload,
                    authorId: req?.user?.id,
                }
            })

            // if (users.length > 0) {
            //     await this.prisma.assignedTask.createMany({
            //         data: users.map(item => ({
            //             userId: item,
            //             taskId: task.id,
            //             deadline: req?.body?.deadline,
            //             assignedById: req?.user?.id
            //         }))
            //     })
            // }

            return res.status(201).json({ result: task })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    getTasks = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const isAdmin = req?.user?.role === user_role.admin;
            let tasks = [];

            if (!isAdmin) {
                tasks = await this.prisma.task.findMany({
                    where: {
                        assignments: {
                            some: {
                                userId: req.user?.id
                            }
                        }
                    }
                })
            } else {
                tasks = await this.prisma.task.findMany({})
            }


            return res.status(200).json({ result: tasks })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    deleteTask = async (req: Request, res: Response) => {
        try {
            const taskId = req.params?.taskId
            await this.prisma.task.delete({
                where: {
                    id: taskId
                }
            })
            return res.status(200).json({ message: "Deleted task successfully!" })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    assignTask = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const taskId = req.params?.taskId as string;
            const userId = req?.body?.userId as string;
            const deadline = req?.body?.deadline as Date

            const taskExist = await this.prisma.task.findFirst({
                where: {
                    id: taskId
                }
            })

            if (!taskExist) {
                return res.status(400).json({ message: "Task not found!" })
            }

            const alreadyAssigned = await this.prisma.assignedTask.findFirst({
                where: {
                    taskId,
                    userId
                }
            })

            if (alreadyAssigned) {
                return res.status(400).json({
                    message: "This user have been assigned to this task already!"
                })
            }

            await this.prisma.assignedTask.create({
                data: {
                    taskId,
                    userId,
                    assignedById: req.user?.id,
                    deadline
                }
            })

            await this.prisma.notification.create({
                data: {
                    userId: req?.user?.id,
                    type: notification_type.updated_task,
                    message: `You just got assigned task:${taskExist.name}`
                }
            })

            return res.status(201).json({ message: "Assigned successfully!" })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    updateTask = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const taskId = req.params?.taskId;
            const updatedTask = await this.prisma.task.update({
                where: {
                    id: taskId,
                },
                data: {
                    ...req?.body
                }
            })
            return res.status(200).json({
                result: updatedTask,
                message: "Updated successfully!"
            })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

}

