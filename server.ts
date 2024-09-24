
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoSanitize from "express-mongo-sanitize";
import cors from "cors";
import compression from "compression";
import helmet from "helmet"
import morgan from "morgan";
import App from "./app/_app";
import startup from "./config/startup";
import UserRoute from "./routes/user";
import { PrismaClient } from "@prisma/client";
import jobs from "./app/jobs";
import { errorHandler } from "./app/middlewares"
import TaskRoute from "./routes/task";
import ProjectRoute from "./routes/project";
// 
const port = process.env.PORT || 5000;

startup()
const prisma = new PrismaClient()

const app = new App({
    port: +port,
    middlewares: [
        helmet(),
        morgan('dev'),
        cors({
            origin: process.env.FRONTEND_URL,
            optionsSuccessStatus: 200,
        }),
        compression(),
        mongoSanitize(),
        express.urlencoded({ extended: true, limit: "10mb" }),
        express.json({ limit: "10mb" }),
        errorHandler,
    ],
    controllers: [
        new UserRoute(prisma),
        new TaskRoute(prisma),
        new ProjectRoute(prisma)
    ]
})

app.listen()

const socketIOServer = app.socketIOServer

socketIOServer.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on("user-connected", async (data) => {
        const { userId, prevSocketId } = data;
        console.log("updateUser-SocketId", data);
        try {
            const socketId = socket.id
            if (socketId === prevSocketId) return;
            await prisma.user.update({ where: { id: userId }, data: { socketId } });
            console.log(`updated ${userId} socketId`);
            // return socket.emit("message", { message: "Welcome Back Brody!", data: socketId })
        } catch (error) {
            console.log(error);
            return;
        }
    })
});

prisma.$connect().then(res => {
    console.log("info: Connected to the DB!")
}).catch(err => {
    throw new Error("info: Couldn't connect to DB!")
})

//runs background job
jobs(prisma);
