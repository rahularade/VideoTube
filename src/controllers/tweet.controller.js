import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet

    const { content } = req.body

    if (!content) {
        throw new ApiError(400, "Content is missing")
    }

    const tweet = await Tweet.create({
        content,
        owner: req.user._id
    })

    if (!tweet) {
        throw new ApiError(400, "Something went wrong while creating tweet")
    }

    return res.status(201).json(
        new ApiResponse(200, tweet, "Tweet Published Successfully")
    )
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid User ID")
    }

    const userTweets = await Tweet.find({
        owner: userId
    })

    if (userTweets.length === 0 ) {
        return res.status(201).json(
            new ApiResponse(200, {}, "User tweets not found")
        )
    }

    return res.status(201).json(
        new ApiResponse(200, userTweets, "User Tweets Fetched Successfully")
    )
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { tweetId } = req.params
    const { content } = req.body

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid Tweet ID")
    }

    if (!content) {
        throw new ApiError(400, "Content is missing")
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        { content },
        { new: true }
    )

    return res.status(201).json(
        new ApiResponse(200, updateTweet, "Tweet Updated Successfully")
    )
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const { tweetId } = req.params

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid Tweet ID")
    }

    const tweet = await Tweet.findByIdAndDelete(tweetId)

    if (!tweet) {
        throw new ApiError(400, "Tweet not found")
    }

    return res.status(201).json(
        new ApiResponse(200, tweet, "Tweet Deleted Successfully")
    )

})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}