import CurlingSheet from './components/CurlingSheet'
import { useEffect, useState } from 'react'
import './App.css'

type MatchFormat = 'four-person' | 'mixed-doubles'
type TeamColor = 'red' | 'yellow'
type Hammer = 'self' | 'opponent'
const APP_STORAGE_KEY = 'curling-strategy-tool-app-state-v1'
type MixedDoublesGuardPosition =
  | 'A1-house'
  | 'A1-hog'
  | 'A2-house'
  | 'A2-hog'
  | 'A3-house'
  | 'A3-hog'
  | 'A4-house'
  | 'A4-hog'

function App() {
  const [matchStarted, setMatchStarted] = useState(false)
  const [showMixedDoublesSetup, setShowMixedDoublesSetup] = useState(false)
  const [mixedDoublesGuardPosition, setMixedDoublesGuardPosition] =
    useState<MixedDoublesGuardPosition>('A2-house')
  const [format, setFormat] = useState<MatchFormat>('four-person')
  const [teamColor, setTeamColor] = useState<TeamColor>('red')
  const [hammer, setHammer] = useState<Hammer>('self')
  const [endCount, setEndCount] = useState(10)
  const [customEndCount, setCustomEndCount] = useState('10')
  const [teamName, setTeamName] = useState('')
  const [opponentName, setOpponentName] = useState('')
  const [playerNames, setPlayerNames] = useState(['', '', '', ''])
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([])
  const [savedMatchToLoad, setSavedMatchToLoad] = useState<SavedMatch | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(APP_STORAGE_KEY)

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          matchStarted?: boolean
          showMixedDoublesSetup?: boolean
          mixedDoublesGuardPosition?: MixedDoublesGuardPosition
          format?: MatchFormat
          teamColor?: TeamColor
          hammer?: Hammer
          endCount?: number
          customEndCount?: string
          teamName?: string
          opponentName?: string
          playerNames?: string[]
        }

        if (typeof parsed.matchStarted === 'boolean') {
          setMatchStarted(parsed.matchStarted)
        }

        if (typeof parsed.showMixedDoublesSetup === 'boolean') {
          setShowMixedDoublesSetup(parsed.showMixedDoublesSetup)
        }

        if (parsed.mixedDoublesGuardPosition) {
          setMixedDoublesGuardPosition(parsed.mixedDoublesGuardPosition)
        }

        if (parsed.format) {
          setFormat(parsed.format)
        }

        if (parsed.teamColor) {
          setTeamColor(parsed.teamColor)
        }

        if (parsed.hammer) {
          setHammer(parsed.hammer)
        }

        if (typeof parsed.endCount === 'number') {
          setEndCount(parsed.endCount)
        }

        if (typeof parsed.customEndCount === 'string') {
          setCustomEndCount(parsed.customEndCount)
        }

        if (typeof parsed.teamName === 'string') {
          setTeamName(parsed.teamName)
        }

        if (typeof parsed.opponentName === 'string') {
          setOpponentName(parsed.opponentName)
        }

        if (Array.isArray(parsed.playerNames)) {
          setPlayerNames(parsed.playerNames)
        }
      } catch {
        localStorage.removeItem(APP_STORAGE_KEY)
      }
    }

    const sheetState = localStorage.getItem('curling-strategy-tool-state-v1')
    if (sheetState) {
      setMatchStarted(true)
      setShowMixedDoublesSetup(false)
    }
  }, [])

  useEffect(() => {
    const payload = {
      matchStarted,
      showMixedDoublesSetup,
      mixedDoublesGuardPosition,
      format,
      teamColor,
      hammer,
      endCount,
      customEndCount,
      teamName,
      opponentName,
      playerNames,
    }

    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(payload))
  }, [matchStarted, showMixedDoublesSetup, mixedDoublesGuardPosition, format, teamColor, hammer, endCount, customEndCount, teamName, opponentName, playerNames])

  useEffect(() => {
    const saved = localStorage.getItem('curling-strategy-tool-matches-v1')

    if (!saved) {
      return
    }

    try {
      setSavedMatches(JSON.parse(saved) as SavedMatch[])
    } catch {
      localStorage.removeItem('curling-strategy-tool-matches-v1')
    }
  }, [])

  const resetToInitialScreen = () => {
    setMatchStarted(false)
    setShowMixedDoublesSetup(false)
    setFormat('four-person')
    setTeamColor('red')
    setHammer('self')
    setEndCount(10)
    setCustomEndCount('10')
    setTeamName('')
    setOpponentName('')
    setPlayerNames(['', '', '', ''])
    setMixedDoublesGuardPosition('A2-house')
    setSavedMatchToLoad(null)
    localStorage.removeItem('curling-strategy-tool-state-v1')
    localStorage.removeItem('curling-strategy-tool-app-state-v1')
  }

  const loadSavedMatchFromStart = (match: SavedMatch) => {
    setFormat(match.matchFormat)
    setEndCount(match.endCount ?? (match.matchFormat === 'four-person' ? 10 : 8))
    setCustomEndCount(String(match.endCount ?? (match.matchFormat === 'four-person' ? 10 : 8)))
    setTeamColor(match.teamColor ?? 'red')
    setHammer(match.initialHammerTeam ?? 'self')
    setTeamName(match.teamName ?? '')
    setOpponentName(match.opponentName ?? '')
    setPlayerNames(match.playerNames ?? ['', '', '', ''])
    setMixedDoublesGuardPosition(match.mixedDoublesGuardPosition ?? 'A2-house')
    setSavedMatchToLoad(match)
    setMatchStarted(true)
    setShowMixedDoublesSetup(false)
  }

  const playerCount = format === 'four-person' ? 4 : 2

  const updatePlayerName = (index: number, value: string) => {
    setPlayerNames((current) =>
      current.map((name, i) => (i === index ? value : name)),
    )
  }

  const handleStartMatch = () => {
    if (format === 'mixed-doubles') {
      setShowMixedDoublesSetup(true)
      return
    }

    setMatchStarted(true)
  }

  const handleStartMixedDoubles = () => {
    setShowMixedDoublesSetup(false)
    setMatchStarted(true)
  }

  return (
    <main className="app">
      {!matchStarted && !showMixedDoublesSetup && <section className="start-screen">
        <header className="app-header">
          <p className="app-label">CURLING</p>
          <h1>Curling Strategy Tool</h1>
          <p className="app-description">
            試合中の投球・盤面・ショットを記録して、あとから振り返るためのツール
          </p>
        </header>

        {savedMatches.length > 0 && (
          <div className="settings-card" style={{ marginBottom: '16px' }}>
            <div className="setting-section">
              <h2>保存した試合</h2>
              <div style={{ display: 'grid', gap: '8px' }}>
                {savedMatches.map((match) => (
                  <div
                    key={match.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: '#475569' }}>
                      {new Date(match.savedAt).toLocaleString()} / {match.scoreSelf}-{match.scoreOpponent}
                    </div>
                    <button
                      className="choice-button"
                      onClick={() => loadSavedMatchFromStart(match)}
                      style={{ margin: 0 }}
                    >
                      途中から続ける
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
      {!matchStarted && showMixedDoublesSetup && (
        <section className="start-screen">
          <header className="app-header">
            <p className="app-label">MIXED DOUBLES</p>
            <h1>置き石の設定</h1>
            <p className="app-description">
              1エンド目の開始前に、先行チームのガード位置を選択してください。
            </p>
          </header>

          <div className="settings-card">
            <div className="setting-section">
              <h2>先行チームの置き石</h2>
              <p className="setting-note">
                センターライン上のA〜D各ポイントについて、ハウス側・ホッグ側から1つ選びます。
              </p>
              <div className="choice-grid two-columns">
                {([
                  ['A1-house', 'A 手前', 'ハウス側 / 4\'6\"'],
                  ['A1-hog', 'A 奥', 'ホッグ側 / 4\'6\"'],
                  ['A2-house', 'B 手前', 'ハウス側 / 6\'6\"'],
                  ['A2-hog', 'B 奥', 'ホッグ側 / 6\'6\"'],
                  ['A3-house', 'C 手前', 'ハウス側 / 8\'6\"'],
                  ['A3-hog', 'C 奥', 'ホッグ側 / 8\'6\"'],
                  ['A4-house', 'D 手前', 'ハウス側 / 10\'6\"'],
                  ['A4-hog', 'D 奥', 'ホッグ側 / 10\'6\"'],
                ] as const).map(([value, label, detail]) => (
                  <button
                    key={value}
                    className={`choice-button ${
                      mixedDoublesGuardPosition === value ? 'selected' : ''
                    }`}
                    onClick={() => setMixedDoublesGuardPosition(value)}
                  >
                    <strong>{label}</strong>
                    <span>{detail}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-section">
              <h2>後攻チームの置き石</h2>
              <p className="setting-note">
                ハウス内のセンターライン上、4-foot円の後端に石の後端を合わせるB位置に配置します。
              </p>
              <div className="match-summary">
                <div>
                  <span>先行チーム</span>
                  <strong>{hammer === 'self' ? '相手チーム' : '自チーム'}</strong>
                </div>
                <div>
                  <span>後攻チーム</span>
                  <strong>{hammer === 'self' ? '自チーム' : '相手チーム'}</strong>
                </div>
                <div>
                  <span>ガード</span>
                  <strong>{mixedDoublesGuardPosition}</strong>
                </div>
                <div>
                  <span>ハウス</span>
                  <strong>B位置</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="choice-button"
                onClick={() => setShowMixedDoublesSetup(false)}
              >
                戻る
              </button>
              <button className="start-button" onClick={handleStartMixedDoubles}>
                置き石を配置して試合開始
              </button>
            </div>
          </div>
        </section>
      )}
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
          mixedDoublesGuardPosition={
            format === 'mixed-doubles' ? mixedDoublesGuardPosition : undefined
          }
          onResetToSetup={resetToInitialScreen}
          savedMatchToLoad={savedMatchToLoad}
          onLoadComplete={() => setSavedMatchToLoad(null)}
        />
      )}
    </main>
  )
}

export default App