/**
 * Parses various date formats commonly found in Excel and Google Sheets
 * @param {string|number} val - The raw value from the sheet
 * @returns {string} - ISO string or the original value if parsing fails
 */
export const parseSheetDate = (val) => {
    if (!val) return val;
    
    // If it's already a Date object or valid ISO string
    if (val instanceof Date) return val.toISOString();
    
    const str = String(val).trim();
    if (!str) return val;

    // Handle common Excel/Google Sheets formats:
    // 1. M-D-YYYY HH:mm:ss or D-M-YYYY HH:mm:ss
    // 2. M/D/YYYY HH:mm:ss or D/M/YYYY HH:mm:ss
    
    // Try standard parsing first (replaces dashes with slashes for better wider compatibility)
    const normalized = str.replace(/-/g, "/");
    const date = new Date(normalized);
    
    if (!isNaN(date.getTime())) {
        return date.toISOString();
    }

    // Custom parsing for D-M-YYYY if standard fails
    // Example: 03-12-2026 23:02:27
    const parts = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?$/);
    if (parts) {
        const [_, d, m, y, h = 0, min = 0, s = 0] = parts;
        // We attempt D-M-Y first as it's common in India, but if M > 12 we swap
        let month = parseInt(m);
        let day = parseInt(d);
        
        if (month > 12) {
            // Likely M-D-Y
            [month, day] = [day, month];
        }
        
        const finalDate = new Date(y, month - 1, day, h, min, s);
        if (!isNaN(finalDate.getTime())) {
            return finalDate.toISOString();
        }
    }

    return val; // Return as-is if all parsing fails
};
