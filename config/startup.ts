import { validateEnvironmentVariables } from "../app/utils/helpers";

/***logs out unhandled rejections and uncaught exceptions */
const logger = () => {
    //catch unexpected exceptions
    process.on("uncaughtException", (ex) => {
        console.log("WE GOT AN UNCAUGHT EXCEPTION", ex);
    });

    //catch unhandled rejections
    process.on("unhandledRejection", (ex) => {
        console.log("WE GOT AN UNHANDLED REJECTION", ex);
    });
}

const validateEnvironmentVariablesHandler = () => {
    const { error } = validateEnvironmentVariables()
    if (error) throw new Error(error.details[0].message)
}


export default function () {
    validateEnvironmentVariablesHandler()
    logger()
}