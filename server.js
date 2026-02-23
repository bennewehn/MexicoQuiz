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

// --- QUESTIONS REMAIN THE SAME ---
const session1Questions = [
    {q : "Welches Tier kämpft auf der mexikanischen Flagge gegen eine Schlange?", options: ["Ein Jaguar", "Ein Adler", "Ein Kondor", "Ein Puma"], answer: 1},
    {q : "Welches dieser weltweit geliebten Lebensmittel verdanken wir den Olmeken aus Mexiko?", options: ["Kaffee", "Bananen", "Schokolade (Kakao)", "Zuckerrohr"], answer: 2},
    {q : "Was wurde früher fertiggestellt – das Kolosseum in Rom oder die Sonnenpyramide in Mexiko?", options: ["Das Kolosseum", "Die Sonnenpyramide", "Beides ungefähr gleichzeitig"], answer: 2}
];

const session2Questions = [
    { q: "Nach dem Sturz des Diktators Huerta (1914) zerstritten sich die Sieger der Revolution. Was war das primäre Ziel der „Konstitutionalisten“ unter Venustiano Carranza im Gegensatz zu den Zielen von Pancho Villa und Emiliano Zapata?", options: ["Die bedingungslose und sofortige Umverteilung von Land an die indigenen Bauern.", "Die Wiederherstellung eines starken Zentralstaates und die Schaffung einer neuen Verfassung.", "Die Ausrufung eines kommunistischen Staates nach russischem Vorbild.", "Die Wiedereinsetzung des alten Diktators Porfirio Díaz."], answer: 1 },
    { q: "Die Verfassung von 1917 (insbesondere Artikel 3, 27 und 123) galt als die modernste ihrer Zeit. Welches der folgenden Rechte war NICHT in diesen berühmten Artikeln verankert?", options: ["Die Garantie auf eine weltliche, vom Staat kontrollierte und kostenlose Schulbildung.", "Die Einführung des 8-Stunden-Arbeitstages und die Erlaubnis für Arbeiter zu streiken", "Das allgemeine Wahlrecht für Frauen auf nationaler Ebene.", "Die Verstaatlichung der Bodenschätze, sodass ausländische Firmen nicht mehr über das mexikanische Öl bestimmen konnten."], answer: 2},
    { q: "Was waren die sogenannten 'Chinampas', die maßgeblich zur Versorgung der wachsenden Bevölkerung von Tenochtitlan beitrugen?", options: ["Handelsgilden, die den Markt von Tlatelolco verwalteten.", "Besondere Kriegskanus, mit denen die Azteken den Texcoco-See kontrollierten.", "Große Aquädukte, die Trinkwasser aus den Bergen in die Stadt leiteten.", "Künstliche Inseln aus Schilf und Schlamm, die für den Ackerbau genutzt wurden."], answer: 3},
    { q: "Der Templo Mayor besaß auf seiner Spitze zwei getrennte Heiligtümer, eines in Rot und eines in Blau. Welche tiefere Bedeutung hatte diese architektonische Zweiteilung?", options: ["Die Farben dienten als Navigationshilfe für die Kanus auf dem Texcoco-See.", "Sie symbolisierte die beiden Grundpfeiler des Reiches: Den Kriegsgott (Huitzilopochtli) und den Regengott (Tlaloc).", "Rot stand für den Sonnenaufgang im Osten und Blau für den Sonnenuntergang im Westen.", "Sie diente der Trennung von Adel und einfachem Volk während der Opferzeremonien."], answer: 1},
    { q: "Warum war das Aztekenreich trotz seiner Größe intern so instabil?", options: ["Fehlende Verteidigungsanlagen in Tenochtitlán.", "Massive Spannungen durch das gewaltsame Tributsystem.", "Ein striktes Verbot von Militärbündnissen mit Nachbarn.", "Der plötzliche Tod von Kolumbus im Jahr 1492."], answer: 1},
    { q: "Welcher Faktor besiegelte den Fall Tenochtitláns nach der „Noche Triste“ endgültig?", options: ["Die Gründung der Inquisition im Jahr 1571.", "Die juristische Gleichstellung durch Karl V.", "Die massive Handlungsunfähigkeit durch die Pocken.", "Die Flucht von La Malinche zu den Maya-Stämmen."], answer: 2},
    { q: "Wer regierte Mexico über 30 Jahre lang als Diktator, bevor die Revolution im Jahr 1910 ausbrach?", options: ["Emilano Zapata", "Pancho Villa", "Porfirio Díaz", "Francisco I. Madero"], answer: 2},
    { q: "Was geschah während der sogenannten „Descena Trágica“ im Jahr 1913?", options: ["Der Sieg Pancho Villas im Norden", "Der Verrat durch Victoriano Huerta und die Ermordung Maderos", "Die Verabschiedung der modernen Verfassung Mexikos", "Die Kapitulation der Zapatisten"], answer: 1},
    {q : "Wer folgte als Anführer der Aufständigen nach Miguel Hidalgo?", options: ["Napoleon", "José Maria Morelos", "Alfonso Diego Velázquez", "Agustín de Iturbide"], answer: 1},
    {q : "Wer wurde neben Hidalgo zur Hinrichtung 1811 verurteilt?", options: ["Diego Alatriste & Iñigo Balboa", "Bernarda Alba & Adela Duarte", "Juan Aldama & Ignacio Allende", "Simón Bolívar & José de San Martín"], answer: 2},
];

function advanceQuestion() {
    state.questionIndex++;
    const currentQuestions = state.session === 1 ? session1Questions : session2Questions;
    Object.values(state.users).forEach(u => u.hasAnswered = false);

    if (state.questionIndex >= currentQuestions.length) {
        const finishedSession = state.session;
        state.questionIndex = -1;
        io.emit('endSession', { 
            session: finishedSession, 
            users: state.users
        });
    } else {
        state.currentQuestionStartTime = Date.now(); 
        const q = currentQuestions[state.questionIndex];
        io.emit('newQuestion', { index: state.questionIndex, q: q.q, options: q.options });
        io.emit('updateHost', { ...state, currentQuestion: q });
    }
}

io.on('connection', (socket) => {
    socket.emit('updateHost', { ...state, currentQuestion: state.session === 1 ? session1Questions[state.questionIndex] : session2Questions[state.questionIndex] });

    socket.on('join', (name) => {
        state.users[socket.id] = { name, totalPoints: 0, answers1: [], answers2: [], hasAnswered: false };
        io.emit('updateHost', state);
    });

    socket.on('answer', (answerIndex) => {
        const user = state.users[socket.id];
        const currentQuestions = state.session === 1 ? session1Questions : session2Questions;
        if (user && !user.hasAnswered && state.questionIndex !== -1) {
            user.hasAnswered = true;
            const timeTaken = (Date.now() - state.currentQuestionStartTime) / 1000;
            const isCorrect = answerIndex === currentQuestions[state.questionIndex].answer;
            if (isCorrect) {
                user.totalPoints += Math.max(500, 1000 - Math.floor(timeTaken * 50));
            }
            state.session === 1 ? user.answers1[state.questionIndex] = answerIndex : user.answers2[state.questionIndex] = answerIndex;
            io.emit('updateHost', { ...state, currentQuestion: currentQuestions[state.questionIndex] });
            
            const allUsers = Object.values(state.users);
            if (allUsers.length > 0 && allUsers.every(u => u.hasAnswered)) {
                setTimeout(() => advanceQuestion(), 2000);
            }
        }
    });

    socket.on('nextQuestion', () => advanceQuestion());

    // --- SESSION 2 START (Scores Reset Here) ---
    socket.on('startSession2', () => {
        state.session = 2;
        state.questionIndex = -1;
        // Reset scores for Session 2
        Object.values(state.users).forEach(u => {
            u.totalPoints = 0;
            u.hasAnswered = false;
        });
        io.emit('sessionSwitch');
        io.emit('updateHost', state);
    });

    // --- FULL RESTART (Resets to Session 1 Lobby) ---
    socket.on('resetGame', () => {
        state.session = 1;
        state.questionIndex = -1;
        Object.values(state.users).forEach(u => {
            u.totalPoints = 0;
            u.answers1 = [];
            u.answers2 = [];
            u.hasAnswered = false;
        });
        io.emit('gameReset'); // Signal clients to go back to "Waiting"
        io.emit('updateHost', state);
    });

    socket.on('disconnect', () => { delete state.users[socket.id]; io.emit('updateHost', state); });
});

server.listen(3000, () => console.log(`Server running on http://localhost:3000`));