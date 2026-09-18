/**
 * Campus Lost & Found Web Portal - Node.js Express Backend
 * Designed for 2nd Year CSE Students
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 8080;
const DB_FILE = path.join(__dirname, 'campus_lost_found.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Validation rules
// ---------------------------------------------------------------------------
const VALID_TYPES = new Set(['LOST', 'FOUND']);
const VALID_CATEGORIES = new Set(['Electronics', 'ID & Wallet', 'Keys', 'Books', 'Apparel', 'Other']);
const VALID_STATUSES = new Set(['OPEN', 'REUNITED']);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/\S+$/;

const MAX_TITLE_LEN = 150;
const MAX_LOCATION_LEN = 150;
const MAX_DESCRIPTION_LEN = 1000;
const MAX_CONTACT_NAME_LEN = 100;
const MAX_CONTACT_INFO_LEN = 150;

function isValidCalendarDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function looksLikeContact(value) {
    return value.split('|').some(part => {
        const trimmed = part.trim();
        return EMAIL_RE.test(trimmed) || PHONE_RE.test(trimmed);
    }) || EMAIL_RE.test(value) || PHONE_RE.test(value);
}

function validateItemPayload(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
        return ['Request body must be a JSON object'];
    }

    const getStr = (field) => (typeof data[field] === 'string' ? data[field].trim() : data[field]);

    const title = getStr('title');
    const type = getStr('type');
    const category = getStr('category');
    const location = getStr('location');
    const dateReported = getStr('date_reported');
    const description = getStr('description');
    const contactName = getStr('contact_name');
    const contactInfo = getStr('contact_info');
    const imageUrl = getStr('image_url');

    const required = { title, type, category, location, date_reported: dateReported, description, contact_name: contactName, contact_info: contactInfo };
    for (const [field, value] of Object.entries(required)) {
        if (!value) errors.push(`Field '${field}' is required`);
    }

    if (errors.length) return errors;

    if (title.length > MAX_TITLE_LEN) errors.push(`Title must be ${MAX_TITLE_LEN} characters or fewer`);
    if (!VALID_TYPES.has(type.toUpperCase())) errors.push("Type must be either 'LOST' or 'FOUND'");
    if (!VALID_CATEGORIES.has(category)) errors.push(`Category must be one of: ${[...VALID_CATEGORIES].sort().join(', ')}`);
    if (location.length > MAX_LOCATION_LEN) errors.push(`Location must be ${MAX_LOCATION_LEN} characters or fewer`);

    if (!DATE_RE.test(dateReported)) {
        errors.push('Date reported must be in YYYY-MM-DD format');
    } else if (!isValidCalendarDate(dateReported)) {
        errors.push('Date reported is not a valid calendar date');
    }

    if (description.length > MAX_DESCRIPTION_LEN) errors.push(`Description must be ${MAX_DESCRIPTION_LEN} characters or fewer`);
    if (contactName.length > MAX_CONTACT_NAME_LEN) errors.push(`Contact name must be ${MAX_CONTACT_NAME_LEN} characters or fewer`);

    if (contactInfo.length > MAX_CONTACT_INFO_LEN) {
        errors.push(`Contact info must be ${MAX_CONTACT_INFO_LEN} characters or fewer`);
    } else if (!looksLikeContact(contactInfo)) {
        errors.push('Contact info must include a valid email or phone number');
    }

    if (imageUrl && !URL_RE.test(imageUrl)) errors.push('Image link must be a valid http:// or https:// URL');

    return errors;
}

// Database Connection
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        initDatabase();
    }
});

function initDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            category TEXT NOT NULL,
            location TEXT NOT NULL,
            date_reported TEXT NOT NULL,
            description TEXT NOT NULL,
            contact_name TEXT NOT NULL,
            contact_info TEXT NOT NULL,
            image_url TEXT,
            status TEXT DEFAULT 'OPEN',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, () => {
        // Seed initial data if table is empty
        db.get('SELECT COUNT(*) as count FROM items', [], (err, row) => {
            if (row && row.count === 0) {
                const sampleItems = [
                    ["Wireless Boat Airdopes (Black)", "LOST", "Electronics", "Central Library Reading Room 2", "2026-09-15", "Left in a black charging case near table 14. Serial number ending in 89.", "Rahul Sharma", "rahul.cs23@campus.edu | Ph: 9876543210", "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&q=80", "OPEN"],
                    ["College ID Card (CSE 2nd Year)", "FOUND", "ID & Wallet", "Main Canteen Counter", "2026-09-16", "Found near juice counter. Name on card: Ananya Verma, Reg No: 2024CSE104.", "Security Desk Gate 1", "security@campus.edu | Ext: 401", "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=500&q=80", "OPEN"],
                    ["Casio FX-991EX Scientific Calculator", "LOST", "Electronics", "CS Department Lab 3", "2026-09-14", "Has a yellow sticker on the back with name 'Karthik'. Essential for upcoming exams!", "Karthik R.", "karthik.r@campus.edu", "https://images.unsplash.com/photo-1611125832047-1d7ad1e8e48a?w=500&q=80", "OPEN"],
                    ["Bunch of 3 Keys with Batman Keychain", "FOUND", "Keys", "Sports Complex Court B", "2026-09-17", "Found on bench near badminton court. 2 brass keys and 1 bike key.", "Priya Nair", "priya.nair@campus.edu", "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=500&q=80", "OPEN"],
                    ["Blue Denim Jacket (Size M)", "FOUND", "Apparel", "Auditorium Block A", "2026-09-12", "Left behind after Freshman Orientation event. Contains a college library slip in pocket.", "Volunteers Helpdesk", "events@campus.edu", "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&q=80", "REUNITED"]
                ];

                const stmt = db.prepare(`
                    INSERT INTO items (title, type, category, location, date_reported, description, contact_name, contact_info, image_url, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                sampleItems.forEach(item => stmt.run(item));
                stmt.finalize();
                console.log('Seeded database with initial campus items.');
            }
        });
    });
}

// REST API Endpoints

// GET /api/stats
app.get('/api/stats', (req, res) => {
    const queries = {
        total: "SELECT COUNT(*) as count FROM items",
        lost: "SELECT COUNT(*) as count FROM items WHERE type='LOST' AND status='OPEN'",
        found: "SELECT COUNT(*) as count FROM items WHERE type='FOUND' AND status='OPEN'",
        reunited: "SELECT COUNT(*) as count FROM items WHERE status='REUNITED'"
    };

    db.all(`
        SELECT 
            (SELECT COUNT(*) FROM items) as total,
            (SELECT COUNT(*) FROM items WHERE type='LOST' AND status='OPEN') as lost,
            (SELECT COUNT(*) FROM items WHERE type='FOUND' AND status='OPEN') as found,
            (SELECT COUNT(*) FROM items WHERE status='REUNITED') as reunited
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows[0]);
    });
});

// GET /api/items (with filtering)
app.get('/api/items', (req, res) => {
    let sql = "SELECT * FROM items WHERE 1=1";
    const params = [];

    const { type, status, category, search } = req.query;

    if (type) {
        sql += " AND type = ?";
        params.push(type);
    }
    if (status) {
        sql += " AND status = ?";
        params.push(status);
    }
    if (category && category !== 'All') {
        sql += " AND category = ?";
        params.push(category);
    }
    if (search) {
        sql += " AND (title LIKE ? OR description LIKE ? OR location LIKE ?)";
        const term = `%${search}%`;
        params.push(term, term, term);
    }

    sql += " ORDER BY id DESC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/items (Create new report)
app.post('/api/items', (req, res) => {
    const { title, type, category, location, date_reported, description, contact_name, contact_info, image_url } = req.body;

    const validationErrors = validateItemPayload(req.body);
    if (validationErrors.length) {
        return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }

    const defaultImg = "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=500&q=80";

    db.run(`
        INSERT INTO items (title, type, category, location, date_reported, description, contact_name, contact_info, image_url, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
    `, [title, type.toUpperCase(), category, location, date_reported, description, contact_name, contact_info, image_url || defaultImg], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Item reported successfully', id: this.lastID });
    });
});

// PATCH /api/items/:id/status
app.patch('/api/items/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const newStatus = status || 'REUNITED';

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'Item id must be a positive integer' });
    }
    if (!VALID_STATUSES.has(newStatus)) {
        return res.status(400).json({ error: `Status must be one of: ${[...VALID_STATUSES].sort().join(', ')}` });
    }

    db.run("UPDATE items SET status = ? WHERE id = ?", [newStatus, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Status updated to ${status || 'REUNITED'}` });
    });
});

// DELETE /api/items/:id
app.delete('/api/items/:id', (req, res) => {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'Item id must be a positive integer' });
    }

    db.run("DELETE FROM items WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Item deleted successfully' });
    });
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
