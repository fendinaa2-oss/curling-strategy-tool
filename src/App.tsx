import CurlingSheet from './components/CurlingSheet'
import { useState } from 'react'
import './App.css'

type MatchFormat = 'four-person' | 'mixed-doubles'
type TeamColor = 'red' | 'yellow'
type Hammer = 'self' | 'opponent'

function App() {
  const [matchStarted, setMatchStarted] = useState(false)
  const [format, setFormat] = useState<MatchFormat>('four-person')
  const [teamColor, setTeamColor] = useState<TeamColor>('red')
  const [hammer, setHammer] = useState<Hammer>('self')
  const [endCount, setEndCount] = useState(10)
  const [customEndCount, setCustomEndCount] = useState('10')
  const [teamName, setTeamName] = useState('')
  const [opponentName, setOpponentName] = useState('')
  const [playerNames, setPlayerNames] = useState(['', '', '', ''])

  const playerCount = format === 'four-person' ? 4 : 2

  const updatePlayerName = (index: number, value: string) => {
    setPlayerNames((current) =>
      current.map((name, i) => (i === index ? value : name)),
    )
  }

  const handleStartMatch = () => {
    setMatchStarted(true)
  }

  return (
    <main className="app">
      {!matchStarted && <section className="start-screen">
        <header className="app-header">
          <p className="app-label">CURLING</p>
          <h1>Curling Strategy Tool</h1>
          <p className="app-description">
            試合中の投球・盤面・ショットを記録して、あとから振り返るためのツール
          </p>
        </header>

        <div className="settings-card">
          <div className="setting-section">
            <h2>試合形式</h2>

            <div className="choice-grid two-columns">
              <button
                className={`choice-button ${
                  format === 'four-person' ? 'selected' : ''
                }`}
                onClick={() => setFormat('four-person')}
              >
                <strong>4人制</strong>
                <span>10エンド</span>
              </button>

              <button
                className={`choice-button ${
                  format === 'mixed-doubles' ? 'selected' : ''
                }`}
                onClick={() => setFormat('mixed-doubles')}
              >
                <strong>Mixed Doubles</strong>
                <span>8エンド</span>
              </button>
            </div>
          </div>

          <div className="setting-section">
            <h2>エンド数</h2>
            <div className="choice-grid four-columns">
              {[6, 8, 10].map((count) => (
                <button
                  key={count}
                  className={`choice-button ${endCount === count ? 'selected' : ''}`}
                  onClick={() => setEndCount(count)}
                >
                  {count}エンド
                </button>
              ))}
              <button
                className={`choice-button ${![6, 8, 10].includes(endCount) ? 'selected' : ''}`}
                onClick={() => setEndCount(Number(customEndCount) || 1)}
              >
                任意
              </button>
            </div>
            <label>
              任意のエンド数
              <input
                type="number"
                min="1"
                max="20"
                value={customEndCount}
                onChange={(event) => {
                  setCustomEndCount(event.target.value)
                  setEndCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))
                }}
              />
            </label>
          </div>

          <div className="setting-section">
            <h2>自チームの色</h2>

            <div className="choice-grid two-columns">
              <button
                className={`choice-button color-button ${
                  teamColor === 'red' ? 'selected' : ''
                }`}
                onClick={() => setTeamColor('red')}
              >
                <span className="color-dot red" />
                赤
              </button>

              <button
                className={`choice-button color-button ${
                  teamColor === 'yellow' ? 'selected' : ''
                }`}
                onClick={() => setTeamColor('yellow')}
              >
                <span className="color-dot yellow" />
                黄
              </button>
            </div>
          </div>

          <div className="setting-section">
            <h2>1エンド目のハンマー</h2>

            <div className="choice-grid two-columns">
              <button
                className={`choice-button ${
                  hammer === 'self' ? 'selected' : ''
                }`}
                onClick={() => setHammer('self')}
              >
                自チーム
              </button>

              <button
                className={`choice-button ${
                  hammer === 'opponent' ? 'selected' : ''
                }`}
                onClick={() => setHammer('opponent')}
              >
                相手チーム
              </button>
            </div>
          </div>

          <div className="setting-section">
            <h2>チーム情報</h2>

            <div className="input-grid">
              <label>
                自チーム名
                <input
                  type="text"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="任意"
                />
              </label>

              <label>
                相手チーム名
                <input
                  type="text"
                  value={opponentName}
                  onChange={(event) => setOpponentName(event.target.value)}
                  placeholder="任意"
                />
              </label>
            </div>
          </div>

          <div className="setting-section">
            <h2>選手名</h2>
            <p className="setting-note">
              名前は任意です。空欄のままでも試合を開始できます。
            </p>

            <div className="player-grid">
              {Array.from({ length: playerCount }, (_, index) => (
                <label key={index}>
                  選手 {index + 1}
                  <input
                    type="text"
                    value={playerNames[index]}
                    onChange={(event) =>
                      updatePlayerName(index, event.target.value)
                    }
                    placeholder="任意"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="match-summary">
            <div>
              <span>形式</span>
              <strong>
                {format === 'four-person' ? '4人制' : 'Mixed Doubles'}
              </strong>
            </div>

            <div>
              <span>通常エンド</span>
              <strong>{endCount}エンド</strong>
            </div>

            <div>
              <span>自チーム</span>
              <strong>{teamColor === 'red' ? '赤' : '黄'}</strong>
            </div>

            <div>
              <span>ハンマー</span>
              <strong>{hammer === 'self' ? '自チーム' : '相手'}</strong>
            </div>
          </div>

          <button className="start-button" onClick={handleStartMatch}>
            試合を開始
          </button>
        </div>
      </section>}
      {matchStarted && (
        <CurlingSheet
          matchFormat={format}
          endCount={endCount}
          onEndCountChange={setEndCount}
          teamColor={teamColor}
          teamName={teamName}
          opponentName={opponentName}
          playerNames={playerNames}
          initialHammerTeam={hammer === 'self' ? 'self' : 'opponent'}
        />
      )}
    </main>
  )
}

export default App