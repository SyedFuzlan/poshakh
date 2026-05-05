"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = handleError;
const errors_1 = require("../errors");
const logger_1 = require("./logger");
function handleError(err, res, ctx) {
    if (err instanceof errors_1.AppError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
    }
    logger_1.logger.error({ err, ...ctx }, "Unhandled error");
    res.status(500).json({ error: "An unexpected error occurred. Please try again." });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFuZGxlLWVycm9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9oYW5kbGUtZXJyb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFJQSxrQ0FPQztBQVZELHNDQUFxQztBQUNyQyxxQ0FBa0M7QUFFbEMsU0FBZ0IsV0FBVyxDQUFDLEdBQVksRUFBRSxHQUFtQixFQUFFLEdBQVk7SUFDekUsSUFBSSxHQUFHLFlBQVksaUJBQVEsRUFBRSxDQUFDO1FBQzVCLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN4RSxPQUFPO0lBQ1QsQ0FBQztJQUNELGVBQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxHQUFHLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQ2pELEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLGlEQUFpRCxFQUFFLENBQUMsQ0FBQztBQUNyRixDQUFDIn0=