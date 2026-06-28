const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
const DB_PATH = path.join(__dirname, 'data.json');

function getDefaultDB() {
    const defaultPassword = hashPassword('admin123');
    return {
        appointments: [],
        contacts: [],
        patients: [],
        admin_users: [
            {
                id: 1,
                username: 'admin',
                password_hash: defaultPassword,
                display_name: 'Dr. Admin',
                role: 'admin',
                created_at: new Date().toISOString()
            }
        ],
        sessions: [],
        counters: { appointments: 0, contacts: 0, patients: 0 }
    };
}

function loadDB() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(raw);
        }
    } catch (err) {
        console.error('DB read error, resetting:', err.message);
    }
    const db = getDefaultDB();
    saveDB(db);
    return db;
}

function saveDB(db) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    } catch (err) {
        console.error('DB write error:', err.message);
    }
}
let db = loadDB();
console.log('✓ Database loaded (' + db.appointments.length + ' appointments, ' + db.patients.length + ' patients)');

if (db.admin_users.length > 0) {
    console.log('✓ Default admin — username: admin, password: admin123');
}
function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'dentacare_salt_2026').digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function generateId(collection) {
    db.counters[collection] = (db.counters[collection] || 0) + 1;
    return db.counters[collection];
}

function now() {
    return new Date().toISOString().replace('T', ' ').split('.')[0];
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const currentTime = new Date().toISOString();
    db.sessions = db.sessions.filter(s => s.expires_at > currentTime);

    const session = db.sessions.find(s => s.token === token);
    if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const user = db.admin_users.find(u => u.id === session.user_id);
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role
    };

    next();
}

function getServiceLabel(value) {
    const services = {
        'checkup': 'General Checkup',
        'implants': 'Dental Implants',
        'cosmetic': 'Cosmetic Dentistry',
        'orthodontics': 'Orthodontics',
        'rootcanal': 'Root Canal',
        'whitening': 'Teeth Whitening',
        'pediatric': 'Pediatric Dentistry',
        'other': 'Other'
    };
    return services[value] || value;
}
app.post('/api/appointments', (req, res) => {
    try {
        const { name, phone, email, service, date, message } = req.body;
        if (!name || !phone || !email || !service || !date) {
            return res.status(400).json({ error: 'All required fields must be filled' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        const phoneRegex = /^[+]?[\d\s\-()]{10,}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        const appointment = {
            id: generateId('appointments'),
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim().toLowerCase(),
            service,
            date,
            message: message || '',
            status: 'pending',
            created_at: now(),
            updated_at: now()
        };

        db.appointments.push(appointment);
        const existingPatient = db.patients.find(
            p => p.email === email.trim().toLowerCase() || p.phone === phone.trim()
        );

        if (existingPatient) {
            existingPatient.total_visits += 1;
            existingPatient.last_visit = now();
            existingPatient.name = name.trim();
        } else {
            db.patients.push({
                id: generateId('patients'),
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim().toLowerCase(),
                total_visits: 1,
                first_visit: now(),
                last_visit: now()
            });
        }

        saveDB(db);

        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully! We will confirm within 30 minutes.',
            appointmentId: appointment.id
        });
    } catch (error) {
        console.error('Appointment error:', error);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});
app.post('/api/contact', (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Name, email, and message are required' });
        }

        db.contacts.push({
            id: generateId('contacts'),
            name: name.trim(),
            email: email.trim().toLowerCase(),
            subject: subject || '',
            message,
            is_read: 0,
            created_at: now()
        });

        saveDB(db);

        res.status(201).json({
            success: true,
            message: 'Message sent successfully! We will get back to you soon.'
        });
    } catch (error) {
        console.error('Contact error:', error);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = db.admin_users.find(u => u.username === username);

        if (!user || user.password_hash !== hashPassword(password)) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        db.sessions.push({
            token,
            user_id: user.id,
            expires_at: expiresAt,
            created_at: now()
        });
        const currentTime = new Date().toISOString();
        db.sessions = db.sessions.filter(s => s.expires_at > currentTime);

        saveDB(db);

        res.json({
            success: true,
            token,
            user: {
                username: user.username,
                displayName: user.display_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});
app.post('/api/admin/logout', authenticateToken, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    db.sessions = db.sessions.filter(s => s.token !== token);
    saveDB(db);
    res.json({ success: true, message: 'Logged out successfully' });
});
app.get('/api/admin/me', authenticateToken, (req, res) => {
    res.json({ success: true, user: req.user });
});
app.get('/api/admin/dashboard', authenticateToken, (req, res) => {
    try {
        const totalAppointments = db.appointments.length;
        const pendingAppointments = db.appointments.filter(a => a.status === 'pending').length;
        const confirmedAppointments = db.appointments.filter(a => a.status === 'confirmed').length;
        const completedAppointments = db.appointments.filter(a => a.status === 'completed').length;
        const cancelledAppointments = db.appointments.filter(a => a.status === 'cancelled').length;
        const totalPatients = db.patients.length;
        const unreadMessages = db.contacts.filter(c => c.is_read === 0).length;

        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = db.appointments.filter(a => a.date === today).length;
        const recentAppointments = [...db.appointments]
            .sort((a, b) => b.id - a.id)
            .slice(0, 5);
        const serviceCounts = {};
        db.appointments.forEach(a => {
            serviceCounts[a.service] = (serviceCounts[a.service] || 0) + 1;
        });
        const serviceStats = Object.entries(serviceCounts)
            .map(([service, count]) => ({ service, count, serviceLabel: getServiceLabel(service) }))
            .sort((a, b) => b.count - a.count);

        res.json({
            success: true,
            stats: {
                totalAppointments,
                pendingAppointments,
                confirmedAppointments,
                completedAppointments,
                cancelledAppointments,
                totalPatients,
                unreadMessages,
                todayAppointments
            },
            recentAppointments: recentAppointments.map(a => ({
                ...a,
                serviceLabel: getServiceLabel(a.service)
            })),
            serviceStats
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
});
app.get('/api/admin/appointments', authenticateToken, (req, res) => {
    try {
        const { status, search, page = 1, limit = 20, sort = 'newest' } = req.query;

        let filtered = [...db.appointments];
        if (status && status !== 'all') {
            filtered = filtered.filter(a => a.status === status);
        }
        if (search) {
            const term = search.toLowerCase();
            filtered = filtered.filter(a =>
                a.name.toLowerCase().includes(term) ||
                a.email.toLowerCase().includes(term) ||
                a.phone.includes(term)
            );
        }

        const total = filtered.length;
        if (sort === 'oldest') {
            filtered.sort((a, b) => a.id - b.id);
        } else if (sort === 'date') {
            filtered.sort((a, b) => a.date.localeCompare(b.date));
        } else {
            filtered.sort((a, b) => b.id - a.id);
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        const paginated = filtered.slice(offset, offset + limitNum);

        res.json({
            success: true,
            appointments: paginated.map(a => ({
                ...a,
                serviceLabel: getServiceLabel(a.service)
            })),
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('List appointments error:', error);
        res.status(500).json({ error: 'Failed to load appointments' });
    }
});
app.get('/api/admin/appointments/:id', authenticateToken, (req, res) => {
    try {
        const appointment = db.appointments.find(a => a.id === parseInt(req.params.id));

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json({
            success: true,
            appointment: { ...appointment, serviceLabel: getServiceLabel(appointment.service) }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load appointment' });
    }
});
app.patch('/api/admin/appointments/:id', authenticateToken, (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be: ' + validStatuses.join(', ') });
        }

        const appointment = db.appointments.find(a => a.id === parseInt(req.params.id));

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        appointment.status = status;
        appointment.updated_at = now();
        saveDB(db);

        res.json({ success: true, message: `Appointment ${status} successfully` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});
app.delete('/api/admin/appointments/:id', authenticateToken, (req, res) => {
    try {
        const index = db.appointments.findIndex(a => a.id === parseInt(req.params.id));

        if (index === -1) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        db.appointments.splice(index, 1);
        saveDB(db);

        res.json({ success: true, message: 'Appointment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete appointment' });
    }
});
app.get('/api/admin/patients', authenticateToken, (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;

        let filtered = [...db.patients];

        if (search) {
            const term = search.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.email.toLowerCase().includes(term) ||
                p.phone.includes(term)
            );
        }

        const total = filtered.length;
        filtered.sort((a, b) => new Date(b.last_visit) - new Date(a.last_visit));

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        const paginated = filtered.slice(offset, offset + limitNum);

        res.json({
            success: true,
            patients: paginated,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load patients' });
    }
});
app.get('/api/admin/messages', authenticateToken, (req, res) => {
    try {
        const { is_read, page = 1, limit = 20 } = req.query;

        let filtered = [...db.contacts];

        if (is_read !== undefined && is_read !== '') {
            filtered = filtered.filter(c => c.is_read === parseInt(is_read));
        }

        const total = filtered.length;
        filtered.sort((a, b) => b.id - a.id);

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        const paginated = filtered.slice(offset, offset + limitNum);

        res.json({
            success: true,
            messages: paginated,
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load messages' });
    }
});
app.patch('/api/admin/messages/:id/read', authenticateToken, (req, res) => {
    try {
        const msg = db.contacts.find(c => c.id === parseInt(req.params.id));
        if (msg) {
            msg.is_read = 1;
            saveDB(db);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update message' });
    }
});
app.delete('/api/admin/messages/:id', authenticateToken, (req, res) => {
    try {
        const index = db.contacts.findIndex(c => c.id === parseInt(req.params.id));
        if (index !== -1) {
            db.contacts.splice(index, 1);
            saveDB(db);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete message' });
    }
});
app.post('/api/admin/change-password', authenticateToken, (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Both current and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = db.admin_users.find(u => u.id === req.user.id);

        if (user.password_hash !== hashPassword(currentPassword)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        user.password_hash = hashPassword(newPassword);
        saveDB(db);

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to change password' });
    }
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.listen(PORT, () => {
    console.log('');
    console.log('  ┌──────────────────────────────────────────────┐');
    console.log('  │                                              │');
    console.log('  │   🦷  DentaCare Premier Server               │');
    console.log('  │                                              │');
    console.log(`  │   ➜  Website:  http://localhost:${PORT}          │`);
    console.log(`  │   ➜  Admin:    http://localhost:${PORT}/admin    │`);
    console.log('  │   ➜  API:      /api/*                        │');
    console.log('  │                                              │');
    console.log('  │   Admin Login:                                │');
    console.log('  │   Username: admin                             │');
    console.log('  │   Password: admin123                          │');
    console.log('  │                                              │');
    console.log('  └──────────────────────────────────────────────┘');
    console.log('');
});
