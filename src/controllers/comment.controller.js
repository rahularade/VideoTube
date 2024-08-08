import mongoose, { isValidObjectId, Mongoose } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID")
    }

    var commentAggregate
    try {
        commentAggregate = await Comment.aggregate(
            [
                {
                    $match: {
                        video: new mongoose.Types.ObjectId(videoId)
                    }
                },
                {
                    $lookup:{
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    username: 1,
                                    email:1,
                                    fullName: 1,
                                    avatar:1
                                }
                            }
                            
                        ]
                    }
                },
                {
                    $addFields:{
                        owner:{
                            $first: "$owner"
                        }
                    }
                }
            ]
        )
    } catch (error) {
        throw new ApiError(500, error.message || "Internal server error in comment aggregation");
    }

    const options = {
        page,
        limit,
        customLabels: {
            totalDocs: "totalComments",
            docs: "comments"
        }
    }

    await Comment.aggregatePaginate(commentAggregate, options)
        .then(result => {
            if (result?.comments?.length === 0) {
                throw new ApiError(200, "Comments not found")
            }

            return res.status(200).json(
                new ApiResponse(200, result, "Comments fetched successfully")
            )
        })
        .catch(error => {
            // Handle errors in aggregation pagination
            throw new ApiError(500, error?.message || "Internal server error in comment aggregate Paginate")
        })

})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const { videoId } = req.params
    const { content } = req.body

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const comment = await Comment.create({
        video: videoId,
        content,
        owner: req.user._id
    })

    if (!comment) {
        throw new ApiError(500, "Something went wrong while adding the comment")
    }

    return res.status(201).json(
        new ApiResponse(200, comment, "Commnet Added Successfully")
    )
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const { commentId } = req.params
    const { content } = req.body

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid Comment ID")
    }

    if(!content){
        throw new ApiError(400, "Content is missing")
    }

    const comment = await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(404, "Comment not found")
    }

    if (comment.owner !== req.user._id) {
        throw new ApiError(403, "You do not have permission to update this comment")
    }
    
    comment.content = content
    await comment.save({ validateBeforeSave: false })

    return res.status(200).json(
        new ApiResponse(200, comment, "Comment Updated Successfully")
    )

})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const { commnetId } = req.params

    if (!isValidObjectId(commnetId)) {
        throw new ApiError(400, "Invalid Comment Id")
    }

    const comment = await Comment.findByIdAndDelete(commnetId)

    if (!comment) {
        throw new ApiError(400, "Comment not found")
    }

    return res.status(201).json(
        new ApiResponse(200, comment, "Comment Deleted Successfully")
    )
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
}