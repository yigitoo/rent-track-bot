module.exports = function authMiddleware(ctx, next) {
  const userId = String(ctx.from?.id);
  if (userId !== process.env.OWNER_CHAT_ID) {
    console.log(`Auth rejected: user=${userId}, expected=${process.env.OWNER_CHAT_ID}`);
    return ctx.reply(`Yetkisiz erişim. Senin ID: ${userId}`);
  }
  return next();
};
