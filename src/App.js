import { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import './App.css';
import './ScoreCard.css';
import FlipMove from 'react-flip-move';
const AWS = require('aws-sdk');

AWS.config.region = 'us-east-1'; // Region
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
	IdentityPoolId: 'us-east-1:70e8bed7-eaf4-40e8-83fc-d03db725c61f',
});
const client = new AWS.S3();

const _getPropSheetScores = () => {
	const bucket = 'prop-sheet';
	const key = 'current_scores.json';
	return new Promise((resolve, reject) => {
		client.getObject({ Bucket: bucket, Key: key }, (err, res) => {
			if (err) {
				reject(err);
			} else {
				resolve(JSON.parse(res.Body.toString('utf-8')));
			}
		});
	});
};

const getPropSheetScores = (callback) => {
	_getPropSheetScores().then((data) => {
		callback(data);
	});
	setTimeout(() => getPropSheetScores(callback), 5000);
};

function App() {
	const [players, setPlayers] = useState([]);

	useEffect(() => {
		getPropSheetScores(setPlayers);
	}, []);

	return (
		<div className='App vh-100'>
			<Container id='main-container' className='mx-auto d-flex justify-content-center'>
				<div id='main-col' className='flex-col align-items-center'>
					<div id='page-title' title='GO BIRDS'>
						<h2>Super Bowl LVII</h2>
						<h1>Leaderboard</h1>
					</div>
					<div id='items'>
						<FlipMove>
							{players.map((player) => {
								return (
									<div className='score-card' key={player.email}>
										<div className='d-flex justify-content-between'>
											<div className='sc-name'>{player.name}</div>
											<div className='sc-score align-self-center'>{player.score}</div>
										</div>
									</div>
								);
							})}
						</FlipMove>
					</div>
				</div>
			</Container>
		</div>
	);
}

export default App;
