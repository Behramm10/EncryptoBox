const Joi = require('joi');

// Room creation validation
const roomSchema = Joi.object({
  ttl: Joi.number().integer().min(60).max(86400).optional(),
  pin: Joi.string().min(4).max(20).optional(),
  maxMembers: Joi.number().integer().min(2).max(100).optional(),
  roomTtlMs: Joi.number().integer().min(60000).max(604800000).optional(),
});

// Message validation
const messageSchema = Joi.object({
  ciphertext: Joi.string().required(),
  iv: Joi.string().required(),
  salt: Joi.string().optional(),
  authTag: Joi.string().allow(null).optional(),
  senderId: Joi.string().optional(),
  ttl: Joi.number().integer().min(30).max(86400).default(300),
});

// Join room validation
const joinRoomSchema = Joi.object({
  pin: Joi.string().optional(),
  clientId: Joi.string().optional(),
  invite: Joi.string().optional(),
});

// Invite creation validation
const inviteSchema = Joi.object({
  ttlSeconds: Joi.number().integer().min(60).max(86400).default(1800),
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    req.body = value;
    next();
  };
};

module.exports = {
  validateRoom: validate(roomSchema),
  validateMessage: validate(messageSchema),
  validateJoinRoom: validate(joinRoomSchema),
  validateInvite: validate(inviteSchema),
};

