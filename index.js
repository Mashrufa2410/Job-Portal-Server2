const express = require('express');
const cors = require('cors');
//
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');  // Make sure cookie-parser is imported if still used

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
//
// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173', 'https://job-portal2-efa9b.web.app', 'job-portal2-efa9b.firebaseapp.com'],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Set Content-Security-Policy to allow workers
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; worker-src 'self' blob:;");
    next();
});

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.olkic.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
    try {
        // await client.connect();
        console.log("Connected to MongoDB");

        const jobsCollection = client.db('Job-Portal').collection('Jobs');
        const jobApplicationCollection = client.db('Job-Portal').collection('job_applications');

        app.get('/', (req, res) => {
            res.send({ message: 'Welcome to the Job Portal API' });
        });

        // GET route for fetching jobs
        app.get('/jobs', async (req, res) => {
            try {
                const email = req.query.email;
                const query = email ? { hr_email: email } : {};
                const jobs = await jobsCollection.find(query).toArray();
                res.status(200).send(jobs);
            } catch (error) {
                console.error('Error fetching jobs:', error);
                res.status(500).send({ error: 'Failed to fetch jobs' });
            }
        });

        // GET route for a single job by ID
        app.get('/jobs/:id', async (req, res) => {
            try {
                const jobId = req.params.id;
                const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });
                job ? res.send(job) : res.status(404).send({ error: 'Job not found' });
            } catch (error) {
                console.error('Error fetching job:', error);
                res.status(500).send({ error: 'Failed to fetch job' });
            }
        });

        // POST route for creating a new job
        app.post('/jobs', async (req, res) => {
            try {
                const newJob = req.body;
                const result = await jobsCollection.insertOne(newJob);
                res.status(201).send(result);
            } catch (error) {
                console.error('Error creating job:', error);
                res.status(500).send({ error: 'Failed to create job' });
            }
        });

        // POST route for job applications
        app.post('/job-applications', async (req, res) => {
            try {
                const application = req.body;
                const result = await jobApplicationCollection.insertOne(application);

                const jobId = application.job_id;
                const filter = { _id: new ObjectId(jobId) };
                const update = { $inc: { applicationCount: 1 } };

                await jobsCollection.updateOne(filter, update);
                res.status(201).send(result);
            } catch (error) {
                console.error('Error creating job application:', error);
                res.status(500).send({ error: 'Failed to create job application' });
            }
        });

        // GET route for fetching all job applications
        app.get('/job-applications', async (req, res) => {
            try {
                const applications = await jobApplicationCollection.find().toArray();
                res.status(200).send(applications);
            } catch (error) {
                console.error('Error fetching job applications:', error);
                res.status(500).send({ error: 'Failed to fetch job applications' });
            }
        });

        // PATCH route for updating job application status
        app.patch('/job-applications/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { status } = req.body;
                const filter = { _id: new ObjectId(id) };
                const update = { $set: { status } };

                const result = await jobApplicationCollection.updateOne(filter, update);
                res.send(result);
            } catch (error) {
                console.error('Error updating application status:', error);
                res.status(500).send({ error: 'Failed to update job application status' });
            }
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            await client.close();
            console.log('MongoDB connection closed on SIGTERM');
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            await client.close();
            console.log('MongoDB connection closed on SIGINT');
            process.exit(0);
        });

    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

run();

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
