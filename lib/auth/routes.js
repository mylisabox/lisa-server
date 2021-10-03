import express from 'express';
const router = new express.Router();

router.post('/login', async function(req, res, next) {
  try {
    const data = await req.services.authService.login(req.body);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/register', async function(req, res, next) {
  try {
    const data = await req.services.authService.register(req.body);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/token', async function(req, res, next) {
  try {
    const data = await req.services.authService.getToken(req.body);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
