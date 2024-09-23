import {
    comparePasswords,
    errorMessage,
    filterUserProfile,
    generateAuthToken,
    generateHashedPassword,
    validateRequestBody
} from '../app/utils/helpers';
import { Router, Request, Response } from 'express';
import { AuthenticatedRequest, IControllerBase, RequestType } from '../app/utils/types';
import { authorizeWithRBAC, userAuth } from '../app/middlewares';
import { PrismaClient, user_role } from '@prisma/client';


export default class UserRoute implements IControllerBase {

    public path = 'users'
    public router = Router()

    constructor(private prisma: PrismaClient) {
        this.initRoutes()
    }

    public initRoutes(): void {
        this.router.post('/login', this.login)
        this.router.post('/register', this.register)
        this.router.get('/profile', userAuth, this.getProfile)
        this.router.get("/team-members", [userAuth, authorizeWithRBAC([user_role.admin])], this.getTeamMembers)

    }

    login = async (req: Request, res: Response) => {
        const { error } = validateRequestBody(req.body, RequestType.SIGN_IN);
        if (error) return res.status(400).json({ message: error.details[0].message })

        try {
            const { email, password } = req.body;

            const user = await this.prisma.user.findFirst({
                where: {
                    email,
                }
            })
            if (!user) return res.status(404).json({ message: 'User not found!' })

            const validPassword = await comparePasswords(password, user.password as string);
            if (!validPassword) return res.status(400).json({ message: "Invalid email or password" });

            const token = generateAuthToken(user.id)

            return res.status(200)
                .header("Authorization", token)
                .header("access-control-expose-headers", "Authorization")
                .json({
                    message: "Logged in successfully!",
                    result: filterUserProfile(user),
                })
        } catch (error) {
            return res.status(500).json(errorMessage(error, true))
        }
    }

    register = async (req: Request, res: Response) => {
        const { error } = validateRequestBody(req.body, RequestType.SIGN_UP);
        if (error) return res.status(400).json({ message: error.details[0].message })
        try {
            const { email } = req.body;

            const userExists = await this.prisma.user.findFirst({
                where: { email }
            })
            if (userExists) return res.status(404).json({ message: 'Email already registered!' })

            const password = generateHashedPassword(req.body?.password)

            const user = await this.prisma.user.create({
                data: {
                    ...req.body,
                    password,
                }
            })

            const token = generateAuthToken(user.id)


            return res.status(201)
                .header("Authorization", token)
                .header("access-control-expose-headers", "Authorization")
                .json({
                    message: "Account created succesfully!",
                    result: filterUserProfile(user),
                })
        } catch (error) {
            return res.status(500).json(errorMessage(error, true))
        }
    }

    getProfile = async (req: AuthenticatedRequest, res: Response) => {
           //@ts-ignore
        //    console.log("socketIoServer", global?.socketIOServer)
        return res.status(200).json({
            result: filterUserProfile(req?.user),
        })
    }

    updateProfile = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            const body = req?.body as Record<string, string>;

            const userExists = await this.prisma.user.findFirst({
                where: {
                    id: userId,
                }
            })

            if (!userExists) {
                return res.status(404).json({ message: "User not found!" })
            }

            if (req?.user?.email !== body?.email) {
                const userWithEmail = await this.prisma.user.findFirst({
                    where: {
                        email: body?.email,
                        // churchId: req?.user?.churchId,
                        id: {
                            not: { equals: userExists.id }
                        }
                    }
                })
                if (userWithEmail) return res.status(400).json({ message: "Email used by another user!" })
            }
            const result = await this.prisma.user.update({
                where: { id: userId },
                data: body,
            })

            return res.status(200).json({
                message: "Update Profile Successfully!",
                result
            })
        } catch (error) {
            console.log(error)
            return res.status(500).json(errorMessage(error))
        }
    }

    updatePassword = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const currentUser = req?.user
            const { oldPassword, newPassword } = req.body;
            const userExists = await this.prisma.user.findFirst({
                where: { id: currentUser?.id },
                select: {
                    password: true
                },
            })

            if (!userExists) {
                return res.status(404).json({ message: "User not found!" })
            }
            const isPassworValid = await comparePasswords(oldPassword, userExists.password as string)
            if (!isPassworValid) {
                return res.status(400).json({ message: "Current password is incorrrect!" })
            }

            const password = generateHashedPassword(newPassword)
            await this.prisma.user.update({ where: { id: currentUser?.id }, data: { password } })

            return res.status(200).json({ message: "Updated password successfully!" })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }

    getTeamMembers = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const members = await this.prisma.user.findMany({
                where: { role: user_role.team }
            })
            return res.status(200).json({ result: members })
        } catch (error) {
            return res.status(500).json(errorMessage(error))
        }
    }
}

