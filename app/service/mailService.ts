import nodemailer from "nodemailer";
import handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";


async function sendEmail(mailData: any) {
    try {
        const content = { ...mailData }
        console.log("content", content);


        const emailTemplateSource = await fs.readFile(
            path.join(__dirname, `../shared/templates/${content?.template}.hbs`), "utf8");

        const mailgunAuth = {
            auth: {
                api_key: process.env.MAILGUN_API_KEY as string,
                domain: process.env.MAILGUN_DOMAIN as string,
            },
        };

        // const smtpTransport = nodemailer.createTransport(mg(mailgunAuth));
        const smtpTransport = nodemailer.createTransport({
            //@ts-ignore
            host: process.env.MAIL_TRANSPORT_HOST as string,
            // port: process.env.MAIL_PORT,
            port: 2525,
            secure: false,
            auth: {
                user: process.env.MAIL_AUTH_USER,
                pass: process.env.MAIL_AUTH_PASSWORD
            }

        });
        const template = handlebars.compile(emailTemplateSource);

        const htmlToSend = template({
            year: new Date().getFullYear(),
            content,
            logo: "https://delegatecapturepro.pw/img/logo-shout.png",
        });


        const mailOptions = {
            from: "Task Manager <mailtrap@demomailtrap.com>",
            // to: mailData?.email,
            to: "gehikhamhen247@gmail.com",
            subject: content?.subject,
            html: htmlToSend,
        };

        const info = await smtpTransport.sendMail(mailOptions);
        console.log(`Successfully sent email to ${mailData.email}.`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

export default sendEmail;

