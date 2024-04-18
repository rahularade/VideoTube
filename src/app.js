import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

//Express Configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"})) //accept json
app.use(express.urlencoded({extended: true, limit: "16kb"})) //acccept data from url
app.use(express.static("public"))
app.use(cookieParser())



export {app}