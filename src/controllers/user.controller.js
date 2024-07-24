import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}
const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend -> req.body
    const { fullName, email, username, password } = req.body

    // validation - not empty
    if ([fullName, email, username, password].some((field) => field?.trim() === "")){
        throw new ApiError(400, "All fields are required")
    }

    // check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
       coverImageLocalPath = req.files?.coverImage[0]?.path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    // upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    // create user object - create entry in db
    const user = await User.create({
        fullName,
        email,
        username : username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // check for user creation 
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // return res
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
    

})

const loginUser = asyncHandler(async (req, res) => {
    // get user details from frontend -> req.body
    const {email, username, password} = req.body

    // check username or email - not empty
    if (!(username || email)) {
        throw new ApiError(400, "username or email is required")
    }

    // find the user in db
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    // Check password
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    // Generate access and refresh token
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    // Send cookies
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully"
        )
    )

})


const logoutUser = asyncHandler(async (req, res) => {
    //Clear Refresh Token
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { 
                refreshToken: 1  //this remove the field from document 
            }
        },
        {
            new: true  //return new updated user
        }

    )

    const options = {
        httpOnly: true,
        secure: true
    }

    //Clear Cookies
    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    //Get refreshToken from cookies
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        //Decode refresh Token
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
        
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        //Check Refresh Token
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        //Generate new Access and Refresh Token
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        // send cookies
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken:newRefreshToken
                },
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})


const changeCurrentPassword = asyncHandler(async(req, res) => {
    //get data from req.body
    const {oldPassword, newPassword} = req.body

    //find user using id
    const user = await User.findById(req.user?._id)

    //check password
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new ApiError(400,"Invalid Password")
    }

    //update password
    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200).json(
        new ApiResponse(200,{},"Password Changed Successfully")
    )
})


const getCurrectUser = asyncHandler(async (req,res) => {
    return res.status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})


const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        { new: true }   //return new updated user
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Account details updated successfully")
    )

})


const updateUserAvatar = asyncHandler( async(req, res) => {
    const avatarLocalPath = req.file?.path
    
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading an avatar")
    }
    
    await deleteFromCloudinary(req.user?.avatar) //delete old image from cloudinary
   
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {avatar : avatar.url}
        },
        { new: true } //return new updated user
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler( async(req, res) => {
    const coverImageLocalPath = req.file?.path
    
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading a cover image")
    }
    
    if(req.user?.coverImage){
        await deleteFromCloudinary(req.user?.coverImage) ////delete old image from cloudinary
    }
 
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {coverImage : coverImage.url}
        },
        { new: true } //return new updated user
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler( async(req, res) => {
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        //$match stage
        {
            $match: {
                username: username?.toLowerCase()
            }
        },

        //$lookup stage for subscribers
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as:"subscribers"
            }
        },

        //$lookup stage for subscriberTo
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as:"subscribedTo"
            }
        },

        //$addFields stage to 
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers" //count Subscribers
                },
                channelsSubscibedToCount: {
                    $size: "$subscribedTo" //count SubscribedTo
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },

        //$project stage 
        {
            $project: {
                fullName:1,
                username:1,
                email:1,
                avatar:1,
                coverImage:1,
                subscribersCount:1,
                channelsSubscibedToCount:1,
                isSubscribed:1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exists")
    }

    return res.status(200).json(
        new ApiResponse(200,
            channel[0], "User channel fetched successfully"
        )
    )
})


const getWatchHistory = asyncHandler( async(req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as:"watchHistory",
                pipeline:[ //nested pipeline
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as:"owner",
                            pipeline: [ //nested pipeline
                                {
                                        $project: {
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner" //Returns the first document
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200).json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrectUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}