import { useState, useEffect, useCallback } from 'react'
import Navbar from '../components/Navbar'
import TeamList from '../components/team/TeamList'
import TeamCreateModal from '../components/team/TeamCreateModal'
import InviteModal from '../components/team/InviteModal'
import apiClient from '../api/client'

function TeamPage() {
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [teamsError, setTeamsError] = useState(null)
  const [membersError, setMembersError] = useState(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  // 내 팀 목록 로드
  const loadTeams = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiClient.get('/teams')
      const teamList = response.data.data || []
      setTeams(teamList)
      setTeamsError(null)
    } catch (err) {
      console.error('팀 목록 로드 실패:', err)
      setTeamsError('팀 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  // 팀원 목록 로드
  const loadMembers = useCallback(async (teamId) => {
    try {
      const response = await apiClient.get(`/teams/${teamId}/members`)
      setMembers(response.data.data || [])
      setMembersError(null)
    } catch (err) {
      console.error('팀원 목록 로드 실패:', err)
      setMembersError('팀원 목록을 불러오지 못했습니다.')
    }
  }, [])

  const handleTeamSelect = useCallback(
    (team) => {
      setSelectedTeam(team)
      setMembers([])
      setMembersError(null)
      loadMembers(team.id)
    },
    [loadMembers]
  )

  const handleTeamCreated = useCallback(() => {
    setShowCreateModal(false)
    loadTeams()
  }, [loadTeams])

  const handleInviteSent = useCallback(() => {
    setShowInviteModal(false)
  }, [])

  // 현재 로그인 사용자의 선택된 팀 역할 확인
  const currentUserRole = selectedTeam?.myRole || null
  const isAdmin = currentUserRole === 'ADMIN'

  return (
    <div className="page-layout">
      <Navbar />
      <main className="team-main">
        <div className="team-header">
          <h2 className="page-title">팀 관리</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + 팀 생성
          </button>
        </div>

        {teamsError && <div className="error-banner">{teamsError}</div>}

        {loading ? (
          <p className="loading-text">로딩 중...</p>
        ) : (
          <div className="team-content">
            <div className="team-list-section">
              <h3 className="section-title">내 팀 목록</h3>
              {teams.length === 0 ? (
                <p className="empty-text">
                  소속된 팀이 없습니다. 팀을 생성해보세요.
                </p>
              ) : (
                <TeamList
                  teams={teams}
                  selectedTeamId={selectedTeam?.id}
                  onSelect={handleTeamSelect}
                />
              )}
            </div>

            {selectedTeam && (
              <div className="member-section">
                <div className="member-section-header">
                  <h3 className="section-title">
                    {selectedTeam.name} 팀원 목록
                  </h3>
                  {isAdmin && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowInviteModal(true)}
                    >
                      팀원 초대
                    </button>
                  )}
                </div>

                {membersError && (
                  <div className="error-banner">{membersError}</div>
                )}

                {members.length === 0 && !membersError ? (
                  <p className="empty-text">팀원이 없습니다.</p>
                ) : (
                  <table className="member-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>이메일</th>
                        <th>역할</th>
                        <th>가입일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.userId}>
                          <td className="member-name">
                            {member.profileImageUrl && (
                              <img
                                src={member.profileImageUrl}
                                alt={member.name}
                                className="member-avatar"
                              />
                            )}
                            {member.name}
                          </td>
                          <td>{member.email || '-'}</td>
                          <td>
                            <span
                              className={`role-badge ${
                                member.role === 'ADMIN'
                                  ? 'role-admin'
                                  : 'role-member'
                              }`}
                            >
                              {member.role === 'ADMIN' ? '관리자' : '일반'}
                            </span>
                          </td>
                          <td>
                            {member.joinedAt
                              ? new Date(member.joinedAt).toLocaleDateString(
                                  'ko-KR'
                                )
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {showCreateModal && (
        <TeamCreateModal
          onCreated={handleTeamCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {showInviteModal && selectedTeam && (
        <InviteModal
          teamId={selectedTeam.id}
          teamName={selectedTeam.name}
          onInvited={handleInviteSent}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  )
}

export default TeamPage
