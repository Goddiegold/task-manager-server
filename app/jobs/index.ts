import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";


export default function (prisma: PrismaClient, runJobs = false) { //set the value of runjobs to true, moved to false to reduce server load
    if (!runJobs) return;

    //sends notification for pending projects
    //this cron job runs at midnight daily
    cron.schedule('0 0 * * *', async function () {
        //@ts-ignore
        const socketIOserverInstance = global?.socketIOServer as Socket | null
        const uncompletedTasks = await prisma.assignedProject.findMany({
            include: { user: { select: { id: true, socketId: true, email: true } } },
            where: {
                completed: false,
                deadline: {
                    gte: startOfDay(new Date()),
                    lte: endOfDay(new Date())
                }
            }
        })
        if (uncompletedTasks.length === 0) return;

        const sentNotifications = new Set()

        uncompletedTasks.map(item => {
            //send mail notification and real time notification to the user
            if (sentNotifications.has(item.userId)) return;
            sentNotifications.add(item.userId)
            socketIOserverInstance.to(item.user.socketId).emit("message", {
                message: "You have a project you haven't completed!",
            });

        })
    });


}
