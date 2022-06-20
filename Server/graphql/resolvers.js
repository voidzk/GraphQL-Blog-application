const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const clearImage = require('../util/file');
const existValidation = require('../util/validation');
const User = require('../models/user');
const Post = require('../models/post');
require('dotenv').config();

module.exports = {
    createUser: async function ({ userInput }, req) {
        const errors = [];
        if (!validator.isEmail(userInput.email)) {
            errors.push({ message: 'E-mail is invalid!' });
        }
        if (
            validator.isEmpty(userInput.email) ||
            !validator.isLength(userInput.password, { min: 5 })
        ) {
            errors.push({ message: 'Password is short..' });
        }

        existValidation(errors.length > 0, 'Invalid Input used..', 422);

        const existingUser = await User.findOne({ email: userInput.email });

        existValidation(existingUser, 'User already Exists', 409);
        const hashedPw = await bcrypt.hash(userInput.password, 12);
        const user = new User({
            email: userInput.email,
            name: userInput.name,
            password: hashedPw,
        });

        const createdUser = await user.save();
        return { ...createdUser._doc, _id: user._id.toString() };
    },
    //
    login: async function ({ email, password }) {
        const user = await User.findOne({ email });

        existValidation(!user, 'User not found..', 401);
        const isEqual = await bcrypt.compare(password, user.password);

        existValidation(!isEqual, 'Password does not match.', 401);

        const token = jwt.sign(
            {
                userId: user._id.toString(),
                email: user.email,
            },
            process.env.JWT_TOKEN,
            { expiresIn: '1h' }
        );

        return { token, userId: user._id.toString() };
    },
    //
    user: async function (ags, req) {
        existValidation(!req.isAuth, 'Not Authenticated', 401);
        const user = await User.findById(req.userId);

        existValidation(!user, 'user does not exist!', 404);
        return {
            ...user._doc,
            _id: user._id.toString(),
        };
    },
    updateStatus: async function ({ status }, req) {
        existValidation(!req.isAuth, 'Not Authenticated', 401);
        const user = await User.findById(req.userId);

        existValidation(!user, 'user does not exist!', 404);
        user.status = status;
        await user.save();
        return {
            ...user._doc,
            _id: user._id.toString(),
        };
    },
    //!---------------------------------------------------------
    //
    createPost: async function ({ postInput }, req) {
        existValidation(!req.isAuth, 'Not Authenticated', 401);
        const errors = [];
        if (
            validator.isEmpty(postInput.title) ||
            !validator.isLength(postInput.title, { min: 5 })
        ) {
            errors.push({ message: 'Title is Invalid' });
        }
        //
        if (
            validator.isEmpty(postInput.content) ||
            !validator.isLength(postInput.content, { min: 5 })
        ) {
            errors.push({ message: 'Content is Invalid' });
        }

        existValidation(errors.length > 0, 'Invalid Input used..', 422);
        const user = await User.findById(req.userId);

        existValidation(!user, 'User not found..', 401);
        const post = new Post({
            title: postInput.title,
            content: postInput.content,
            imageUrl: postInput.imageUrl,
            creator: user,
        });

        const createdPost = await post.save();
        user.posts.push(createdPost);
        await user.save();
        return {
            ...createdPost._doc,
            _id: createdPost._id.toString(),
            createdAt: createdPost.createdAt.toISOString(),
            updatedAt: createdPost.updatedAt.toISOString(),
        };
    },
    //
    //!-----------------------------------------
    //
    posts: async function ({ page }, req) {
        existValidation(!req.isAuth, 'Not Authenticated', 401);
        if (!page) {
            page = 1;
        }

        const perPage = 2;

        const totalPosts = await Post.find().countDocuments();
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage)
            .populate('creator');

        return {
            posts: posts.map(p => {
                return {
                    ...p._doc,
                    _id: p._id.toString(),
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString(),
                };
            }),
            totalPosts,
        };
    },

    post: async function ({ id }, req) {
        existValidation(!req.isAuth, 'Not Authenticated', 401);
        const post = await Post.findById(id).populate('creator');

        existValidation(!post, 'No post fonud!', 404);
        return {
            ...post._doc,
            _id: post._id.toString(),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
        };
    },

    updatePost: async function ({ id, postInput }, req) {
        existValidation(!req.isAuth, 'Not Authenticated', 401);
        const post = await Post.findById(id).populate('creator');

        existValidation(!post, 'No post found!', 404);

        existValidation(
            post.creator._id.toString() !== req.userId.toString(),
            'Not Authorized',
            403
        );
        const errors = [];
        if (
            validator.isEmpty(postInput.title) ||
            !validator.isLength(postInput.title, { min: 5 })
        ) {
            errors.push({ message: 'Title is Invalid' });
        }
        //
        if (
            validator.isEmpty(postInput.content) ||
            !validator.isLength(postInput.content, { min: 5 })
        ) {
            errors.push({ message: 'Content is Invalid' });
        }

        existValidation(errors.length > 0, 'Invalid Input used..', 422);
        post.title = postInput.title;
        post.content = postInput.content;

        if (postInput.imageUrl !== 'undefined') {
            post.imageUrl = postInput.imageUrl;
        }

        const updatedPost = await post.save();

        return {
            ...updatedPost._doc,
            _id: updatedPost._id.toString(),
            createdAt: updatedPost.createdAt.toISOString(),
            updatedAt: updatedPost.updatedAt.toISOString(),
        };
    },

    deletePost: async function ({ id }, req) {
        existValidation(!req.isAuth, 'Not Authenticated', 401);
        const post = await Post.findById(id);

        existValidation(!post, 'No post found!', 404);
        existValidation(
            post.creator._id.toString() !== req.userId.toString(),
            'Not Authorized',
            403
        );
        clearImage(post.imageUrl);
        await Post.findByIdAndRemove(id);
        const user = await User.findById(req.userId);
        user.posts.pull(id);
        await user.save();
        return true;
    },
};
