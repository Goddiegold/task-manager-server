import { IControllerBase } from './utils/types';
import express from 'express'
import { Application } from 'express'
import { exec } from 'child_process';

class App {
    public app: Application
    public port: number
    // public server: Server
    // public socketIOServer: SocketIOServer

    constructor(appInit: {
        port: number,
        middlewares: any[],
        controllers: IControllerBase[]
    }) {
        this.app = express();
        this.port = appInit.port
        this.middlewares(appInit.middlewares)
        this.routes(appInit.controllers)
    }

    private middlewares(middlewares: any[]) {
        middlewares.forEach(middleware => {
            this.app.use(middleware)
        })
    }

    private routes(controllers: IControllerBase[]) {
        controllers.forEach(controller => {
            this.app.use(`/api/${controller.path}`, controller.router)
        })
    }

    public updateFromRepo() {
        this.app.post("/updated-repo", (req, res) => {
            exec('bash ../deploy.sh', (error: any, stdout: any, stderr: any) => {
                if (error) {
                    console.error(`Deployment script execution failed: ${error}`);
                    return res.status(500).end();
                }
                console.log(`Deployment successful: ${stdout}`);
            });
            return res.status(200).end();
        })
    }

    public listen() {
        this.updateFromRepo()
        this.app.get("/", (req, res) => {
            return res.status(200).send({
                message: "Task Manager - V1.0"
            })
        })
        this.app.listen(this.port, () => {
            console.log(`info: App running on http://localhost:${this.port}`)
        })
    }


}


export default App
