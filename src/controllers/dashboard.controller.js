import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.

    if(!req.user?._id){
        throw new ApiError(404, "Unauthorized request")
    }

    const { userId } = req.user?._id

    const channelStats = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            // Lookup for Subscribers of a channel
            $lookup: {
                from: "subscriptions",
                localField: "owner",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            // Lookup for the channel which the owner Subscribe
            $lookup: {
                from: "subscriptions",
                localField: "owner",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            // Lookup likes for the user's videos
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likedVideos"
            }
        },
        {
            // Lookup comments for the user's videos
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "videoComments"
            }
        },
        {
            // Lookup tweets by the user
            $lookup: {
                from: "tweets",
                localField: "owner",
                foreignField: "owner",
                as: "tweets"
            }
        },
        {
            $group: {
                totalVideos: { $sum: 1 },
                totalViews: { $sum: "$views" },
                subscribers: { $first: "$subscribers"},
                subscribedTo: { $first: "$subscribedTo"},
                totalLikes: { $sum: { $size: "$likedVideos" }},
                totalComments: { $sum: { $size: "$videoComments" }},
                totalTweets: { $sum: { $size: "$tweets" }},
            }
        },
        {
            $project: {
                totalVideos: 1,
                totalViews: 1,
                subscribers: 1,
                subscribedTo: 1,
                totalLikes: 1,
                totalComments: 1,
                totalTweets: 1,
            }
        }
        
    ])

    if (!channelStats) {
        throw new ApiError(400, "Something went wrong")
    }

    return res.status(201).json(
        new ApiResponse(200, channelStats[0], "Channel stats fetched successfully")
    )
})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel

    if(!req.user?._id){
        throw new ApiError(404, "Unauthorized request")
    }

    const { userId } = req.user?._id

    const videos = await Video.find({
        owner: userId
    })

    if (videos.length === 0) {
        return res.status(201).json(
            new ApiResponse(200, {}, "No videos found")
        )
    }

    return res.status(201).json(
        new ApiResponse(200, videos, "Total Videos Fetched Successfully")
    )
})

export {
    getChannelStats, 
    getChannelVideos
    }