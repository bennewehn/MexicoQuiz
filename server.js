const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let state = {
    session: 1,
    questionIndex: -1, 
    users: {},
    currentQuestionStartTime: 0
};

// Distinct question sets
const session1Questions = [
    { q: "What was Mexico originally known as before independence?", options: ["New Spain", "Mesoamerica", "New World", "Gran Colombia"], answer: 0 },
    { q: "Which ancient civilization built the capital city of Tenochtitlan?", options: ["Maya", "Olmec", "Zapotec", "Aztec"], answer: 3 }
];

const session2Questions = [
    { q: "Who was the first emperor of independent Mexico?", options: ["Benito Juárez", "Agustín de Iturbide", "Maximiliano I", "Vicente Guerrero"], answer: 1 },
    { q: "In what year did the Mexican Revolution start?", options: ["1810", "1821", "1910", "1917"], answer: 2 }
];

function advanceQuestion() {
    state.questionIndex++;
    const currentQuestions = state.session === 1 ? session1Questions : session2Questions;

    Object.values(state.users).forEach(user => user.hasAnswered = false);

    if (state.questionIndex >= currentQuestions.length) {
        state.questionIndex = -1;
        io.emit('endSession', { 
            session: state.session, 
            users: state.users,
            fullQuizData: state.session === 2 ? [...session1Questions, ...session2Questions] : null
        });
    } else {
        // --- CALCULATION POINT A: RECORD START TIME ---
        state.currentQuestionStartTime = Date.now(); 
        const q = currentQuestions[state.questionIndex];
        io.emit('newQuestion', { 
            index: state.questionIndex, 
            q: q.q, 
            options: q.options 
        });
    }
    io.emit('updateHost', state);
}

io.on('connection', (socket) => {
        socket.on('join', (name) => {
        state.users[socket.id] = { 
            name, 
            totalPoints: 0, // <--- Using Points instead of score
            answers1: [], 
            answers2: [], 
            hasAnswered: false 
        };
        io.emit('updateHost', state);
    });

    socket.on('answer', (answerIndex) => {
        const user = state.users[socket.id];
        const currentQuestions = state.session === 1 ? session1Questions : session2Questions;
        
        if (user && !user.hasAnswered && state.questionIndex !== -1) {
            user.hasAnswered = true;

            // --- CALCULATION POINT B: COMPUTE DURATION ---
            const timeTaken = (Date.now() - state.currentQuestionStartTime) / 1000;
            const isCorrect = answerIndex === currentQuestions[state.questionIndex].answer;
            
            if (isCorrect) {
                // Scoring Formula: 1000 base - 50 points per second. Minimum 500.
                const speedPenalty = Math.floor(timeTaken * 50);
                const points = Math.max(500, 1000 - speedPenalty);
                user.totalPoints += points;
            }

            if (state.session === 1) {
                user.answers1[state.questionIndex] = answerIndex;
            } else {
                user.answers2[state.questionIndex] = answerIndex;
            }
            
            io.emit('updateHost', state);
        
            const allUsers = Object.values(state.users);
            if (allUsers.length > 0 && allUsers.every(u => u.hasAnswered)) {
                setTimeout(() => advanceQuestion(), 1500);
            }
        }
    });

    socket.on('nextQuestion', () => advanceQuestion());

    socket.on('startSession2', () => {
        state.session = 2;
        state.questionIndex = -1;
        io.emit('sessionSwitch');
    });

    socket.on('disconnect', () => {
        delete state.users[socket.id];
        io.emit('updateHost', state);
    });
});

server.listen(3000, () => console.log(`Server running on http://localhost:3000`));