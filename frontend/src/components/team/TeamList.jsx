const ROLE_LABEL = {
  ADMIN: '관리자',
  MEMBER: '일반',
}

function TeamList({ teams, selectedTeamId, onSelect }) {
  return (
    <ul className="team-card-list">
      {teams.map((team) => (
        <li
          key={team.id}
          className={`team-card ${selectedTeamId === team.id ? 'team-card-selected' : ''}`}
          onClick={() => onSelect(team)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(team)}
        >
          <div className="team-card-name">{team.name}</div>
          {team.description && (
            <div className="team-card-desc">{team.description}</div>
          )}
          {team.myRole && (
            <span
              className={`role-badge ${
                team.myRole === 'ADMIN' ? 'role-admin' : 'role-member'
              }`}
            >
              {ROLE_LABEL[team.myRole] || team.myRole}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

export default TeamList
