"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPasswordHash = setPasswordHash;
exports.verifyPassword = verifyPassword;
exports.hasPassword = hasPassword;
exports.setEmailVerified = setEmailVerified;
const bcrypt_1 = __importDefault(require("bcrypt"));
const redis_1 = require("./redis");
const BCRYPT_ROUNDS = 12;
const key = (id) => `auth_meta:${id}`;
async function read(customerId) {
    const raw = await (0, redis_1.getRedisClient)().get(key(customerId));
    return raw ? JSON.parse(raw) : null;
}
async function write(customerId, meta) {
    await (0, redis_1.getRedisClient)().set(key(customerId), JSON.stringify(meta));
}
async function setPasswordHash(customerId, plainPassword) {
    const existing = await read(customerId);
    await write(customerId, {
        emailVerified: existing?.emailVerified ?? false,
        createdAt: existing?.createdAt ?? Date.now(),
        passwordHash: await bcrypt_1.default.hash(plainPassword, BCRYPT_ROUNDS),
    });
}
async function verifyPassword(customerId, plain) {
    const meta = await read(customerId);
    if (!meta?.passwordHash)
        return false;
    return bcrypt_1.default.compare(plain, meta.passwordHash);
}
async function hasPassword(customerId) {
    const meta = await read(customerId);
    return !!meta?.passwordHash;
}
async function setEmailVerified(customerId) {
    const existing = await read(customerId);
    await write(customerId, {
        passwordHash: existing?.passwordHash,
        createdAt: existing?.createdAt ?? Date.now(),
        emailVerified: true,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC1tZXRhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9hdXRoLW1ldGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFzQkEsMENBT0M7QUFFRCx3Q0FJQztBQUVELGtDQUdDO0FBRUQsNENBT0M7QUFqREQsb0RBQTRCO0FBQzVCLG1DQUF5QztBQUV6QyxNQUFNLGFBQWEsR0FBRyxFQUFFLENBQUM7QUFRekIsTUFBTSxHQUFHLEdBQUcsQ0FBQyxFQUFVLEVBQUUsRUFBRSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUM7QUFFOUMsS0FBSyxVQUFVLElBQUksQ0FBQyxVQUFrQjtJQUNwQyxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUEsc0JBQWMsR0FBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUN4RCxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ3BELENBQUM7QUFFRCxLQUFLLFVBQVUsS0FBSyxDQUFDLFVBQWtCLEVBQUUsSUFBYztJQUNyRCxNQUFNLElBQUEsc0JBQWMsR0FBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3BFLENBQUM7QUFFTSxLQUFLLFVBQVUsZUFBZSxDQUFDLFVBQWtCLEVBQUUsYUFBcUI7SUFDN0UsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDeEMsTUFBTSxLQUFLLENBQUMsVUFBVSxFQUFFO1FBQ3RCLGFBQWEsRUFBRSxRQUFRLEVBQUUsYUFBYSxJQUFJLEtBQUs7UUFDL0MsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtRQUM1QyxZQUFZLEVBQUUsTUFBTSxnQkFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsYUFBYSxDQUFDO0tBQzlELENBQUMsQ0FBQztBQUNMLENBQUM7QUFFTSxLQUFLLFVBQVUsY0FBYyxDQUFDLFVBQWtCLEVBQUUsS0FBYTtJQUNwRSxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNwQyxJQUFJLENBQUMsSUFBSSxFQUFFLFlBQVk7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUN0QyxPQUFPLGdCQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDbEQsQ0FBQztBQUVNLEtBQUssVUFBVSxXQUFXLENBQUMsVUFBa0I7SUFDbEQsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDcEMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQztBQUM5QixDQUFDO0FBRU0sS0FBSyxVQUFVLGdCQUFnQixDQUFDLFVBQWtCO0lBQ3ZELE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3hDLE1BQU0sS0FBSyxDQUFDLFVBQVUsRUFBRTtRQUN0QixZQUFZLEVBQUUsUUFBUSxFQUFFLFlBQVk7UUFDcEMsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtRQUM1QyxhQUFhLEVBQUUsSUFBSTtLQUNwQixDQUFDLENBQUM7QUFDTCxDQUFDIn0=