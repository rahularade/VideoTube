import mongoose, { isValidObjectId } from "mongoose"
import {Video} from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler( async (req, res) =>{
    // Extract page, limit, query, sortBy, sortType, and userId from req.query

    const { page = 1, limit = 10, query = "", sortBy = "createdAt", sortType = 1, userId } = req.query

    // Initialize match condition
    const matchCondition = {
        $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ]
    };

    // Add owner condition if userId is provided
    if (userId) {
        matchCondition.owner = new mongoose.Types.ObjectId(userId);
    }

    var videoAggregate; // Declare a variable for video aggregation pipeline
    try{
        // Define the aggregation pipeline
        videoAggregate = Video.aggregate(
            [
                {
                     // Match stage: find videos by title, description, and optionally owner
                    $match: matchCondition
                },
                {
                     // Lookup stage: join with users collection to get video owner details
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline:[
                            {
                                // Project stage: select specific fields from user
                                $project: {
                                    _id: 1,
                                    fullName: 1,
                                    avatar: 1,
                                    username: 1
                                }
                            }
                        ]
                    }
                },
                {
                    // Add fields stage: add the first (and only) owner object to the video document
                    $addFields:{
                        owner:{
                            $first: "$owner",
                        }
                    }
                },
                {
                    // Sort stage: sort videos by specified field and type
                    $sort:{
                        [ sortBy || "createdAt"]: sortType || 1
                    }
                }
            ]
        )
    }
    catch(error){
         // Handle errors in aggregation
        throw new ApiError(500, error.message || "Internal server error in video aggregation");
}

    const options = {
        // Define pagination options
        page,
        limit,
        customLabels: {
            totalDocs: "totalVideos",
            docs: "videos"
        },
        skip: (page - 1) * limit,
    }

     // Execute aggregation with pagination
    Video.aggregatePaginate(videoAggregate, options)
        .then(result => {
            // Handle case when no videos are found
            if (result?.videos?.length === 0 && userId) {
                return res.status(200).json(
                    new ApiResponse(200, [], "No videos found")
                )
            }

            // Respond with fetched videos and success message
            return res.status(200).json(
                new ApiResponse( 200, result, "Video fetched Successfully")
            )
        })
        .catch(error => {
            // Handle errors in aggregation pagination
            throw new ApiError(500, error?.message || "Internal server error in video aggregate Paginate")
        })
    
})

const publishAVideo = asyncHandler( async (req, res) => {
    const { title, description } = req.body

    if(!(title && description)){
        throw new ApiError(400, "Title and Description are required")
    }

    const videoLocalPath = req.files?.videoFile[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path

    if(!(videoLocalPath && thumbnailLocalPath)) {
        throw new ApiError(400, "Video and thumnail are missing")
    }

    const video = await uploadOnCloudinary(videoLocalPath)

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    const videoPublished = await Video.create({
        title,
        description,
        videoFile: video.url,
        thumbnail: thumbnail.url,
        duration: video.duration,
        owner : req.user._id
    })

    return res.status(201).json(
        new ApiResponse( 200, videoPublished, "Video Published Successfully")
    )
})
