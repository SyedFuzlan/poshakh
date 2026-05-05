"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
let client = null;
function getRedisClient() {
    if (!client) {
        client = new ioredis_1.default(process.env.REDIS_URL ?? "redis://localhost:6379", {
            maxRetriesPerRequest: 3,
            lazyConnect: false,
        });
        client.on("error", (err) => logger_1.logger.error({ err }, "[Redis] connection error"));
    }
    return client;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVkaXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3JlZGlzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBS0Esd0NBU0M7QUFkRCxzREFBNEI7QUFDNUIscUNBQWtDO0FBRWxDLElBQUksTUFBTSxHQUFpQixJQUFJLENBQUM7QUFFaEMsU0FBZ0IsY0FBYztJQUM1QixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDWixNQUFNLEdBQUcsSUFBSSxpQkFBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxJQUFJLHdCQUF3QixFQUFFO1lBQ3BFLG9CQUFvQixFQUFFLENBQUM7WUFDdkIsV0FBVyxFQUFFLEtBQUs7U0FDbkIsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLGVBQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDLENBQUM7SUFDakYsQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMifQ==