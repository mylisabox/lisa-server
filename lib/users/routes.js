import express from 'express';
const router = new express.Router();

/* GET logged user. */
router.get('/me', async function(req, res, next) {
  try {
    res.json(await req.services.userService.get(req.user.id));
  } catch (e) {
    next(e);
  }
});

/* PATCH save logged user. */
router.patch('/me', async function(req, res, next) {
  req.storageAvatar.single('avatar')(req, res, async (err) => {
    if (err) {
      next(err);
    } else {
      try {
        const user = req.body;
        if (req.file && req.file.filename) {
          user.avatar = '/avatar/' + req.file.filename;
        }
        delete user.id; // make sure we don't save another ID
        res.json(await req.services.userService.save(req.user.id, req.body));
      } catch (e) {
        next(e);
      }
    }
  });
});

export default router;
