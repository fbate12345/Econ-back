import express from 'express';
import mailgun from 'mailgun-js';
import expressAsyncHandler from 'express-async-handler';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import data from '../data.js';
import User from '../models/userModel.js';
import { generateToken, isAdmin, isAuth } from '../utils.js';

const userRouter = express.Router();

userRouter.get(
  '/seed',
  expressAsyncHandler(async (req, res) => {
    // await User.remove({});
    const createdUsers = await User.insertMany(data.users);
    res.send({ createdUsers });
  })
);

userRouter.post(
  '/signin',
  expressAsyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      if (bcrypt.compareSync(req.body.password, user.password)) {
        res.send({
          _id: user._id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          isSeller: user.isSeller,
          token: generateToken(user),
        });
        return;
      }
    }
    res.status(401).send({ message: 'Invalid email or password' });
  })
);

userRouter.post(
  '/register',
  expressAsyncHandler(async (req, res) => {
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, 8),
    });
    const createdUser = await user.save();
    res.send({
      _id: createdUser._id,
      name: createdUser.name,
      email: createdUser.email,
      isAdmin: createdUser.isAdmin,
      isSeller: createdUser.isSeller,
      token: generateToken(createdUser),
    });
  })
);

userRouter.get(
  '/:id/seller',
  expressAsyncHandler(async (req, res) => {
    const user = await User.findOne({ 'seller.url': req.params.id });
    if (user) {
      res.send(user);
    } else {
      res.status(404).send({ message: 'User Not Found' });
    }
  })
);
userRouter.get(
  '/:id',
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
      res.send(user);
    } else {
      res.status(404).send({ message: 'User Not Found' });
    }
  })
);
userRouter.put(
  '/profile',
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      if (req.body.password) {
        user.password = bcrypt.hashSync(req.body.password, 8);
      }
      if (user.isSeller) {
        user.seller.name = req.body.sellerName;
        user.seller.logo = req.body.sellerLogo;
        user.seller.url = req.body.sellerUrl;
        user.seller.description = req.body.sellerDescription;
      }
      const updatedUser = await user.save();
      res.send({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        isSeller: updatedUser.isSeller,
        token: generateToken(updatedUser),
      });
    }
  })
);

userRouter.get(
  '/',
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const users = await User.find({});
    res.send(users);
  })
);

userRouter.delete(
  '/:id',
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
      if (user.email === 'admin@example.com') {
        res.status(400).send({ message: 'Can Not Delete Admin User' });
        return;
      }
      const deleteUser = await user.remove();
      res.send({ message: 'User Deleted', user: deleteUser });
    } else {
      res.status(404).send({ message: 'User Not Found' });
    }
  })
);

userRouter.put(
  '/:id',
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.isSeller = req.body.isSeller || user.isSeller;
      user.isAdmin = req.body.isAdmin || user.isAdmin;
      const updatedUser = await user.save();
      res.send({ message: 'User Updated', user: updatedUser });
    } else {
      res.status(404).send({ message: 'User Not Found' });
    }
  })
);

userRouter.put(
  '/:email/forget-password',

  expressAsyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.params.email });
    if (user) {
      user.resetToken = uuidv4();
      const updatedUser = await user.save();
      const DOMAIN = process.env.MAILGUN_API_URL;
      const mg = mailgun({
        apiKey: process.env.MAILGUN_API_KEY,
        domain: DOMAIN,
      });
      const data = {
        from: 'Excited User <me@samples.mailgun.org>',
        to: user.email,
        subject: 'Request Reset Password',
        text: `Hello ${user.name} 
        You requested to reset your password.         
        Please open this link to reset your password.         
        http://localhost:3000/reset-password/${user.resetToken} 
         
        Regards,  
        Ecommerce Website
         `,
        html: `Hello ${user.name} <br/>
        You requested to reset your password.
        <br/>
        Please open this link to reset your password. 
        <br/>
        <a href="http://localhost:3000/reset-password/${user.resetToken} ">http://localhost:3000/reset-password/${user.resetToken} </a>
        <br />
        Regards, <br/>
        Ecommerce Website
         `,
      };
      mg.messages().send(data, function (error, body) {
        console.log(error);
        console.log(body);
      });
      // Send an email with the reset token link
      res.send({ message: 'Reset Token Has Been Set', user: updatedUser });
    } else {
      res
        .status(404)
        .send({ message: 'A user with this email has not found.' });
    }
  })
);

userRouter.get(
  '/request-reset-password/:id',

  expressAsyncHandler(async (req, res) => {
    const resetToken = req.params.id;
    const user = await User.findOne({ resetToken });
    if (user) {
      res.send({ message: 'Success', user });
    } else {
      res.status(400).send({
        message:
          'Reset token is not valid. Please follow forget password again.',
      });
    }
  })
);

userRouter.put(
  '/:id/reset-password',

  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
      if (user.resetToken === req.body.resetToken) {
        console.log(req.body.password);
        user.password = bcrypt.hashSync(req.body.password, 8);
        user.resetToken = null;
        await user.save();
        const DOMAIN = process.env.MAILGUN_API_URL;
        const mg = mailgun({
          apiKey: process.env.MAILGUN_API_KEY,
          domain: DOMAIN,
        });
        const data = {
          from: 'Excited User <me@samples.mailgun.org>',
          to: user.email,
          subject: 'Your password has been reset successfully',
          text: `Hello ${user.name} 
          Your password has been reset successfully.
          Regards,  
          Ecommerce Website
         `,
          html: `Hello ${user.name} <br/>
        Your password has been reset successfully.<br />
        Regards, <br/>
        Ecommerce Website
         `,
        };
        mg.messages().send(data, function (error, body) {
          console.log(error);
          console.log(body);
        });
        res.send({
          message:
            'Reset password has been done successfully. Please signin again.',
        });
      } else {
        res.status(400).send({
          message:
            'Reset token is not valid. Please follow forget password again.',
        });
      }
    } else {
      res.status(404).send({
        message: 'User Not Found',
      });
    }
  })
);

export default userRouter;
