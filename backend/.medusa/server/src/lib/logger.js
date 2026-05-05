"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
exports.logger = (0, pino_1.default)({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    base: { service: "poshakh-api" },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    ...(process.env.NODE_ENV !== "production" && {
        transport: { target: "pino-pretty", options: { colorize: true } },
    }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9sb2dnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsZ0RBQXdCO0FBRVgsUUFBQSxNQUFNLEdBQUcsSUFBQSxjQUFJLEVBQUM7SUFDekIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO0lBQy9ELElBQUksRUFBRSxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUU7SUFDaEMsU0FBUyxFQUFFLGNBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPO0lBQ3hDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxZQUFZLElBQUk7UUFDM0MsU0FBUyxFQUFFLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxPQUFPLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLEVBQUU7S0FDbEUsQ0FBQztDQUNILENBQUMsQ0FBQyJ9