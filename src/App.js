import { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import FlipMove from 'react-flip-move';
// import players from './data.json';
import Container from 'react-bootstrap/Container';
import players1 from './data1.json';
import players2 from './data2.json';
import './App.css';
import ScoreCard from './ScoreCard';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const setPlayers = async (callback) => {
	callback(players1);
	await sleep(2500);
	callback(players2);
	setTimeout(() => setPlayers(callback), 2500);
};

function App() {
	const [players, setPlayersState] = useState([players1]);

	useEffect(() => {
		setPlayers(setPlayersState);
	}, []);

	return (
		<div className='App vh-100'>
			<Container id='main-container' className='mx-auto d-flex justify-content-center'>
				<div id='main-col' className='flex-col align-items-center'>
					<div id='page-title' title='GO BIRDS'>
						<h2>Super Bowl LVII</h2>
						<h1>Leaderboard</h1>
					</div>
					<FlipMove>
						<div class='items'>
							{players.map((player) => {
								console.log('player:');
								return <ScoreCard player={player} />;
							})}
						</div>
					</FlipMove>
				</div>
			</Container>
		</div>
	);
}

export default App;
