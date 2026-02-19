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
    users: {} 
};

// Your Mexican History Questions
const questions = [
    { q: "What was Mexico originally known as before independence?", options: ["New Spain", "Mesoamerica", "New World", "Gran Colombia"], answer: 0 },
    { q: "Who was the first emperor of independent Mexico?", options: ["Benito Juárez", "Agustín de Iturbide", "Maximiliano I", "Vicente Guerrero"], answer: 1 },
    { q: "In what year did the Mexican Revolution start?", options: ["1810", "1821", "1910", "1917"], answer: 2 },
    { q: "Which ancient civilization built the capital city of Tenochtitlan?", options: ["Maya", "Olmec", "Zapotec", "Aztec"], answer: 3 }
];

// Helper function to advance the presentation
function advanceQuestion() {
    state.questionIndex++;
    
    // Reset the "hasAnswered" flag for the new question
    Object.values(state.users).forEach(user => user.hasAnswered = false);

    if (state.questionIndex >= questions.length) {
        state.questionIndex = -1; // Quiz finished
        io.emit('endSession', { 
            session: state.session, 
            users: state.users,
            quizData: state.session === 2 ? questions : null 
        });
    } else {
        const q = questions[state.questionIndex];
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
        // Added "hasAnswered" tracker
        state.users[socket.id] = { name, score1: 0, score2: 0, answers2: [], hasAnswered: false };
        io.emit('updateHost', state); 
    });

    socket.on('answer', (answerIndex) => {
        const user = state.users[socket.id];
        
        // Only accept the answer if they haven't voted yet on this question
        if (user && !user.hasAnswered) {
            user.hasAnswered = true; 
            
            const isCorrect = answerIndex === questions[state.questionIndex].answer;
            if (state.session === 1) {
                if (isCorrect) user.score1++;
            } else {
                user.answers2[state.questionIndex] = answerIndex;
                if (isCorrect) user.score2++;
            }
            io.emit('updateHost', state);

            // --- AUTO-SKIP LOGIC ---
            // Check if every connected participant has voted
            const allUsers = Object.values(state.users);
            const everyoneVoted = allUsers.length > 0 && allUsers.every(u => u.hasAnswered);
            
            if (everyoneVoted) {
                // Wait 1.5 seconds, then advance automatically
                setTimeout(() => {
                    advanceQuestion();
                }, 1500);
            }
        }
    });

    // Manual override for the Host
    socket.on('nextQuestion', () => {
        advanceQuestion();
    });

    socket.on('startSession2', () => {
        state.session = 2;
        state.questionIndex = -1;
        io.emit('sessionSwitch', 2);
    });

    socket.on('disconnect', () => {
        delete state.users[socket.id];
        io.emit('updateHost', state);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));