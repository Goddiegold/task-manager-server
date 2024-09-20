import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import twilio from "twilio";


export default function (prisma: PrismaClient, runJobs = false) {
    if (!runJobs) return;

    //sends notification for upcoming service
    cron.schedule('* * * * *', async function () {
    });

    //sends notification for missed service
    cron.schedule('* * * * *', async function () {
    });


}
