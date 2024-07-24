import mongoose, { isValidObjectId } from "mongoose"
import {Video} from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js"


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
    // Extract title and description from request body
    const { title, description } = req.body

    // Check if title and description are provided
    if(!(title && description)){
        throw new ApiError(400, "Title and Description are required")
    }

    // Get paths for video and thumbnail files from request
    const videoLocalPath = req.files?.videoFile[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path

    // Check if video and thumbnail paths are provided
    if(!(videoLocalPath && thumbnailLocalPath)) {
        throw new ApiError(400, "Video and thumnail are missing")
    }

    // Upload video file & thumbnail file to Cloudinary
    const video = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    // Create a new video document in the database
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

const getVideoById = asyncHandler ( async (req, res) => {
    // Extract video ID from request parameters
    const videoId = req.params

    // Check if the provided video ID is valid
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

      // Find the video by its ID in the database
    const video = await Video.findById(videoId)

    // Check if the video exists
    if (!video) {
        throw new ApiError(400, "Video not found")
    }

    return res.status(200).json(
        new ApiResponse(200, video, "Video fetched successfully")
    )
})

const updateVideo = asyncHandler( async (req, res) => {
    // Update video details like title, description, thumbnail
    const videoId = req.params
    const { title, description } = req.body

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        new ApiError(400, "Video not found")
    }

    // Store the old thumbnail URL to delete it later
    const oldThumbnail = video.thumbnail

    if(!(title && description)){
        throw new ApiError(400, "Title and Description are required")
    }

    // Get the path for the new thumbnail file from the request
    const thumbnailLocalPath = req.file?.path
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is missing")
    }

    // Upload the new thumbnail to Cloudinary
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    if (!thumbnail.url) {
        throw new ApiError(400, "Error while uploading a thumbnail")
    } 


    // Update the video details in the database
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: thumbnail.url
            }
        },
        { new: true }
    )
    
    // Delete the old thumbnail from Cloudinary
    await deleteFromCloudinary(oldThumbnail)

    return res.status(200).json(
        new ApiResponse(200, updateVideo, "Video Updated Successfully")
    )

})

const deleteVideo = asyncHandler( async (req, res) => {
     const videoId = req.params

     if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
     }
     
     // Find the video by its ID and delete it from the database
     const video = await Video.findByIdAndDelete(videoId)

     if (!video) {
        throw new ApiError(400, "Video not found")
     }

     // Delete the video file & thumbnail from Cloudinary
     await deleteFromCloudinary(video.videoFile)
     await deleteFromCloudinary(video.thumbnail)

     return res.status(200).json(
        new ApiResponse(200, video, "Video Deleted Successfully")
     )
})

const togglePublishStatus = asyncHandler( async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Inavlid video ID")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(400, "Video not found")
    }

    // Toggle the publish status of the video
    video.isPublished = !video.isPublished;

    // Save the updated video document
    await video.save({ validateBeforeSave: false })

    return res.status(200).json(
        new ApiResponse(200, video, "isPublished toggle successfully")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}