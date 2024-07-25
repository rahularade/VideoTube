import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID")
    }

    const subscriptionCheck  = await Subscription.findOneAndDelete({
        channel: channelId,
        subscriber: req.user?._id
    })

    if (subscriptionCheck) {
        return res.status(201).json(
            new ApiResponse(200, {}, "Subscription Removed Successfully")
        )
    }

    const createSubscription  = await Subscription.create({
        channel: channelId,
        subscriber: req.user?._id
    })

    return res.status(201).json(
        new ApiResponse(200, createSubscription, "Congratulation! You have Successfully Subscribed this channel")
    )
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID")
    }

    const subscribers = await Subscription.find({
        channel: channelId
    }).populate({
        path: "subscribers",
        select: "fullName email username avatar coverImage"
    })

    if(subscribers === 0){
        return res.status(201).json(
            new ApiResponse(200, 0 ,"You don't have subscribers yet")
        )
    }
    return res.status(200).json(
        new ApiResponse(200, subscribers, "Subscribers are fetched successfully")
    )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

        if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID")
    }

    const channels = await Subscription.find({
        subscriber: subscriberId
    }).populate({
        path: "channels",
        select: "fullName email username avatar coverImage"
    })

    if(channels === 0){
        return res.status(201).json(
            new ApiResponse(200, 0 ,"You don't subscribed any yet")
        )
    }
    return res.status(200).json(
        new ApiResponse(200, channels, "Subscribed channels are fetched successfully")
    )
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}