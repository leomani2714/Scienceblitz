# ScienceBlitz

ScienceBlitz is a fast-paced science quiz game for testing your knowledge of
Physics, Chemistry, Zoology, and Botany. Play solo or create a multiplayer room
and compete with friends in real time.

## Features

- Physics topics: Mechanics, Electricity, Waves, and Thermodynamics
- Chemistry topics: Atomic Structure, Periodic Table, Bonding, and Reactions
- Zoology topics: Animal Anatomy and Classification
- Botany topics: Plant Morphology and Physiology
- Easy, Medium, and Hard difficulty levels
- Configurable quiz length and time per question
- Optional timer, lives, hints, and mixed-subject mode
- Score multipliers for answer streaks and speed bonuses
- XP, levels, accuracy tracking, end-of-game review, and leaderboard display
- Keyboard shortcuts for choices: `A`, `B`, `C`, and `D`
- Pause, resume, skip, theme, and sound controls
- Multiplayer rooms with synchronized questions, answers, and live scores

## Getting Started

### Requirements

- A modern web browser
- Node.js 18 or newer for multiplayer/server mode

### Run Locally

1. Open a terminal in the project directory:

	```text
	cd Scienceblitz-main
	```

2. Install dependencies:

	```text
	npm install
	```

3. Start the multiplayer server:

	```text
	npm start
	```

4. Visit [http://localhost:10000](http://localhost:10000) in your browser.

The Node server serves the game and loads `questions.json`. The multiplayer
room server uses WebSockets on the same port.

## Multiplayer

1. Open the Multiplayer panel and enter your name.
2. Create a room and share the displayed six-character code.
3. Other players enter the code and join the room.
4. The host configures the quiz on the main screen and starts the round.
5. Each player answers the shared questions independently; scores update live.

At least two players are required to start a multiplayer round.

## Deploy To Render

Create a new **Web Service** in Render and connect this repository. Use:

- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** no additional variables required

Render provides the `PORT` environment variable automatically. After the
deployment finishes, open the generated HTTPS URL and share it with players.

## How to Play

1. Select Physics, Chemistry, Zoology, Botany, or mixed-subject mode.
2. Choose a difficulty and one or more topics.
3. Configure the timer, lives, hints, question count, and time per question.
4. Select an answer or use the `A`-`D` keyboard keys.
5. Use hints, skip questions, or pause the game when needed.
6. Review your score, accuracy, streak, XP, and answered questions at the end.

## Project Structure

```text
Scienceblitz-main/
├── index.html       # Game interface, styles, and JavaScript logic
├── questions.json   # Physics, Chemistry, Zoology, and Botany question bank
├── server.js        # Static web server and WebSocket multiplayer rooms
├── package.json     # Node.js start script and dependencies
└── README.md        # Project documentation
```

## Customizing Questions

Questions are stored in `questions.json`, grouped by subject, topic, and
difficulty:

```json
{
  "q": "What is the SI unit of force?",
  "a": "Newton",
  "opts": ["Newton", "Joule", "Watt", "Pascal"]
}
```

Keep the answer in `a` exactly equal to one of the values in `opts`. The game
will shuffle the options automatically.

## License

No license has been specified for this project.
