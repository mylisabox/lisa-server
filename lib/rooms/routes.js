import express from 'express';
const router = new express.Router();

/* GET rooms. */
router.get('/', async function(req, res, next) {
  try {
    res.json(await req.services.roomService.getAll());
  } catch (e) {
    next(e);
  }
});

/* Create new room. */
router.post('/', async function(req, res, next) {
  try {
    res.json(await req.services.roomService.save(req.body));
  } catch (e) {
    next(e);
  }
});

/* Update room. */
router.put('/:id', async function(req, res, next) {
  try {
    req.body.id = req.params.id;
    res.json(await req.services.roomService.save(req.body));
  } catch (e) {
    next(e);
  }
});

/* Delete room. */
router.delete('/:id', async function(req, res, next) {
  try {
    await req.services.roomService.delete(req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
