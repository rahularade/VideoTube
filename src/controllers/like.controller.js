import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const like = await Like.findOneAndDelete({
        video: videoId,
        likedBy: req.user._id
    })

    if (like) {
        return res.status(201).json(
            new ApiResponse(200, {}, "Video like toggle successfully")
        )
    }

    const likedVideo = await Like.create({
        video: videoId,
        likedBy: req.user._id
    })

    return res.status(201).json(
        new ApiResponse(200, likedVideo, "Video like toggle successfully")
    )
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID")
    }

    const like = await Like.findOneAndDelete({
        comment: commentId,
        likedBy: req.user._id
    })

    if (like) {
        return res.status(201).json(
            new ApiResponse(200, {}, "Comment like toggle successfully")
        )
    }

    const likedComment = await Like.create({
        comment: commentId,
        likedBy: req.user._id
    })

    return res.status(201).json(
        new ApiResponse(200, likedComment, "Comment like toggle successfully")
    )
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID")
    }

    const like = await Like.findOneAndDelete({
        tweet: tweetId,
        likedBy: req.user._id
    })

    if (like) {
        return res.status(201).json(
            new ApiResponse(200, {}, "Tweet like toggle successfully")
        )
    }

    const likedTweet = await Like.create({
        tweet: tweetId,
        likedBy: req.user._id
    })

    return res.status(201).json(
        new ApiResponse(200, likedTweet, "Tweet like toggle successfully")
    )
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const likedVideos = await Like.find({
        likedBy: req.user?._id,
        video: { $ne: null }
    }).populate("video")

    if(likedVideos.length === 0){
        return res.status(201).json(
            new ApiResponse(200, {}, "You haven't liked any videos yet")
        )
    }

    return res.status(201).json(
        new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    )
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}