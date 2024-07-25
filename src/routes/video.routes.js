import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { deleteVideo, getAllVideos, getVideoById, publishAVideo, togglePublishStatus, updateVideo } from "../controllers/video.contoller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router()

router.use(verifyJWT)// Apply verifyJWT middleware to all routes in this file

router.route("/")
    .get(getAllVideos)
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount:1
            },
            {
                name: "thumbnail",
                maxCount: 1
            }
        ]),
        publishAVideo
    )

router.route("/:videoId")
    .get(getVideoById)
    .delete(deleteVideo)
    .patch( upload.single("thumbnail"), updateVideo)

router.route("/toggle/publish/:videoId").post(togglePublishStatus)

export default router