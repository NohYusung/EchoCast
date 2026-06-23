'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type ResourceId = 'project' | 'episode' | 'canvas' | 'record' | 'artist' | 'character' | 'export' | 'admin';
type ActionId = 'view' | 'create' | 'edit' | 'delete' | 'manage';
type PermissionMap = Record<ResourceId, Record<ActionId, boolean>>;
type AdminRole = {
    id: string;
    name: string;
    color: string;
    system: boolean;
    desc: string;
    perms: PermissionMap;
};
type AdminMember = {
    id: string;
    name: string;
    email: string;
    initials: string;
    av: string;
    roleIds: string[];
    active: boolean;
};
type AdminDb = {
    roles: AdminRole[];
    members: AdminMember[];
};
type AdminTab = 'roles' | 'members';
type AssignMenu = {
    memberId: string;
    left: number;
    top: number;
};

const RES: {
    id: ResourceId;
    ko: string;
    en: string;
    icon: ReactNode;
}[] = [
    {
        id: 'project',
        ko: '작품',
        en: 'Project',
        icon: (
            <>
                <rect height="18" rx="2.5" width="18" x="3" y="3" />
                <path d="M3 9h18M9 9v12" />
            </>
        ),
    },
    {
        id: 'episode',
        ko: '에피소드',
        en: 'Episode',
        icon: (
            <>
                <rect height="16" rx="2" width="20" x="2" y="4" />
                <path d="M2 9h20M7 4v5" />
            </>
        ),
    },
    {
        id: 'canvas',
        ko: '캔버스',
        en: 'Canvas',
        icon: (
            <>
                <rect height="18" rx="2" width="18" x="3" y="3" />
                <path d="M3 15l5-5 4 4 3-3 6 6" />
                <circle cx="8.5" cy="8.5" r="1.5" />
            </>
        ),
    },
    {
        id: 'record',
        ko: '녹음',
        en: 'Record',
        icon: (
            <>
                <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
            </>
        ),
    },
    {
        id: 'artist',
        ko: '성우·캐스팅',
        en: 'Artist',
        icon: (
            <>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
            </>
        ),
    },
    {
        id: 'character',
        ko: '캐릭터',
        en: 'Character',
        icon: (
            <>
                <circle cx="9" cy="8" r="3.4" />
                <circle cx="17" cy="10" r="2.6" />
                <path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7-4.6" />
            </>
        ),
    },
    {
        id: 'export',
        ko: '내보내기',
        en: 'Export',
        icon: (
            <>
                <path d="M12 3v12M8 7l4-4 4 4" />
                <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
            </>
        ),
    },
    {
        id: 'admin',
        ko: '멤버·권한',
        en: 'Admin',
        icon: (
            <>
                <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
                <path d="m9 12 2 2 4-4" />
            </>
        ),
    },
];
const ACT: { id: ActionId; ko: string }[] = [
    { id: 'view', ko: '조회' },
    { id: 'create', ko: '생성' },
    { id: 'edit', ko: '수정' },
    { id: 'delete', ko: '삭제' },
    { id: 'manage', ko: '관리' },
];
const ROLE_COLORS = ['#4d8dff', '#2dd4bf', '#a78bfa', '#fbbf24', '#f472b6', '#34d399', '#f2585b', '#5b9bff'];
const STORAGE_KEY = 'tooned:rbac';

const PRESETS = [
    {
        id: 'readonly',
        name: '읽기 전용',
        dot: '#5b9bff',
        desc: '모든 리소스 조회만 허용',
        tokens: '*:view',
        apply: (perms: PermissionMap) => grant(perms, allResourceIds(), ['view']),
    },
    {
        id: 'content',
        name: '콘텐츠 제작',
        dot: '#a78bfa',
        desc: '작품·에피소드·캔버스·캐릭터 편집',
        tokens: '4×crud',
        apply: (perms: PermissionMap) => grant(perms, ['project', 'episode', 'canvas', 'character'], ['view', 'create', 'edit']),
    },
    {
        id: 'recording',
        name: '녹음 작업',
        dot: '#f472b6',
        desc: '녹음 전체 + 성우·캐릭터 조회',
        tokens: 'record:*',
        apply: (perms: PermissionMap) => {
            grant(perms, ['record'], ['view', 'create', 'edit', 'delete']);
            grant(perms, ['artist', 'character'], ['view']);
        },
    },
    {
        id: 'export',
        name: '내보내기',
        dot: '#34d399',
        desc: '내보내기 조회·실행',
        tokens: 'export',
        apply: (perms: PermissionMap) => grant(perms, ['export'], ['view', 'create']),
    },
    {
        id: 'full',
        name: '전체 관리',
        dot: '#4d8dff',
        desc: '모든 리소스의 모든 권한 (*:*)',
        tokens: '*:*',
        apply: grantAll,
    },
];

export function StudioAdminDashboard() {
    const [db, setDb] = useState<AdminDb>(() => seed());
    const [selectedRoleId, setSelectedRoleId] = useState(() => seed().roles[0]?.id ?? null);
    const [tab, setTab] = useState<AdminTab>('roles');
    const [filter, setFilter] = useState('');
    const [toastMessage, setToastMessage] = useState('');
    const [assignMenu, setAssignMenu] = useState<AssignMenu | null>(null);
    const [storageLoaded, setStorageLoaded] = useState(false);

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            const parsed = stored ? JSON.parse(stored) : null;
            const normalized = normalizeDb(parsed);

            if (normalized) {
                setDb(normalized);
                setSelectedRoleId(normalized.roles[0]?.id ?? null);
            }
        } catch {
            const seeded = seed();
            setDb(seeded);
            setSelectedRoleId(seeded.roles[0]?.id ?? null);
        } finally {
            setStorageLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!storageLoaded) return;

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }, [db, storageLoaded]);

    useEffect(() => {
        if (!toastMessage) return undefined;

        const timer = window.setTimeout(() => setToastMessage(''), 1900);

        return () => window.clearTimeout(timer);
    }, [toastMessage]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName;

            if (event.key === '/' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                event.preventDefault();
                document.getElementById('topSearch')?.focus();
            }

            if (event.key === 'Escape') {
                setAssignMenu(null);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', closeAssignMenu);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', closeAssignMenu);
        };
    }, []);

    const selectedRole = useMemo(() => roleById(db, selectedRoleId), [db, selectedRoleId]);
    const filteredSystemRoles = useMemo(
        () => db.roles.filter((role) => role.system && matchesRole(role, filter)),
        [db.roles, filter]
    );
    const filteredCustomRoles = useMemo(
        () => db.roles.filter((role) => !role.system && matchesRole(role, filter)),
        [db.roles, filter]
    );
    const filteredMembers = useMemo(() => db.members.filter((member) => matchesMember(member, filter)), [db.members, filter]);

    const showToast = (message: string) => setToastMessage(message);
    const closeAssignMenu = () => setAssignMenu(null);
    const switchTab = (nextTab: AdminTab) => {
        setTab(nextTab);
        setAssignMenu(null);
    };
    const changeFilter = (value: string) => {
        setFilter(value);
        setAssignMenu(null);
    };

    const createRole = () => {
        const role: AdminRole = {
            id: `r_${Date.now().toString(36)}`,
            name: getNextRoleName(db.roles),
            color: ROLE_COLORS[db.roles.length % ROLE_COLORS.length],
            system: false,
            desc: '',
            perms: emptyPerms(),
        };

        setDb((current) => ({ ...current, roles: [...current.roles, role] }));
        setSelectedRoleId(role.id);
        setTab('roles');
        showToast('역할을 만들었습니다 · 권한을 지정하세요');
    };
    const duplicateRole = (roleId: string | null) => {
        const role = roleById(db, roleId);
        if (!role) return;

        const copiedRole: AdminRole = {
            ...role,
            id: `r_${Date.now().toString(36)}`,
            name: `${role.name} 복사본`,
            color: ROLE_COLORS[db.roles.length % ROLE_COLORS.length],
            system: false,
            perms: clonePerms(role.perms),
        };

        setDb((current) => ({ ...current, roles: [...current.roles, copiedRole] }));
        setSelectedRoleId(copiedRole.id);
        showToast(`"${role.name}"을(를) 복제했습니다`);
    };
    const deleteRole = (roleId: string | null) => {
        const role = roleById(db, roleId);
        if (!role || role.system) return;

        const assignedCount = memberCount(db, role.id);
        const confirmed = window.confirm(
            `"${role.name}" 역할을 삭제할까요?${assignedCount ? `\n\n현재 ${assignedCount}명에게 배정되어 있으며, 해당 배정도 함께 해제됩니다.` : ''}`
        );
        if (!confirmed) return;

        setDb((current) => {
            const nextRoles = current.roles.filter((item) => item.id !== role.id);
            const nextMembers = current.members.map((member) => ({
                ...member,
                roleIds: member.roleIds.filter((id) => id !== role.id),
            }));

            setSelectedRoleId(nextRoles[0]?.id ?? null);
            return { roles: nextRoles, members: nextMembers };
        });
        showToast('역할을 삭제했습니다');
    };
    const updateSelectedRole = (patch: Partial<Pick<AdminRole, 'name' | 'desc'>>) => {
        if (!selectedRole || selectedRole.system) return;

        setDb((current) => ({
            ...current,
            roles: current.roles.map((role) => (role.id === selectedRole.id ? { ...role, ...patch } : role)),
        }));
    };
    const mutateSelectedRolePerms = (mutate: (perms: PermissionMap) => void) => {
        if (!selectedRole || selectedRole.system) return;

        setDb((current) => ({
            ...current,
            roles: current.roles.map((role) => {
                if (role.id !== selectedRole.id) return role;

                const perms = clonePerms(role.perms);
                mutate(perms);
                return { ...role, perms };
            }),
        }));
    };
    const togglePermissionCell = (resourceId: ResourceId, actionId: ActionId) => {
        mutateSelectedRolePerms((perms) => {
            perms[resourceId][actionId] = !perms[resourceId][actionId];
        });
    };
    const toggleRow = (resourceId: ResourceId) => {
        if (!selectedRole) return;

        const shouldEnable = ACT.some((action) => !selectedRole.perms[resourceId][action.id]);
        mutateSelectedRolePerms((perms) => {
            ACT.forEach((action) => {
                perms[resourceId][action.id] = shouldEnable;
            });
        });
    };
    const toggleColumn = (actionId: ActionId) => {
        if (!selectedRole) return;

        const shouldEnable = RES.some((resource) => !selectedRole.perms[resource.id][actionId]);
        mutateSelectedRolePerms((perms) => {
            RES.forEach((resource) => {
                perms[resource.id][actionId] = shouldEnable;
            });
        });
    };
    const applyPreset = (presetId: string) => {
        const preset = PRESETS.find((item) => item.id === presetId);
        if (!preset) return;

        mutateSelectedRolePerms((perms) => preset.apply(perms));
        showToast(`"${preset.name}" 프리셋을 적용했습니다`);
    };
    const unassignRole = (memberId: string, roleId: string) => {
        setDb((current) => ({
            ...current,
            members: current.members.map((member) =>
                member.id === memberId ? { ...member, roleIds: member.roleIds.filter((id) => id !== roleId) } : member
            ),
        }));
    };
    const toggleMemberRole = (memberId: string, roleId: string) => {
        setDb((current) => ({
            ...current,
            members: current.members.map((member) => {
                if (member.id !== memberId) return member;

                const hasRole = member.roleIds.includes(roleId);
                return {
                    ...member,
                    roleIds: hasRole ? member.roleIds.filter((id) => id !== roleId) : [...member.roleIds, roleId],
                };
            }),
        }));
    };

    return (
        <main className="admin-html-clone" data-testid="studio-admin-dashboard">
            <header className="topbar">
                <Link className="brand" href="/studio/products">
                    <span className="mark">
                        <svg fill="none" viewBox="0 0 24 24">
                            <path d="M4 5h16M4 12h10M4 19h16" stroke="#fff" strokeLinecap="round" strokeWidth="2.4" />
                            <circle cx="19" cy="12" fill="#fff" r="2.4" />
                        </svg>
                    </span>
                    Tooned
                </Link>
                <div className="crumb">
                    <span className="sep">/</span>
                    <Link className="lnk" href="/studio/products">
                        내 작품
                    </Link>
                    <span className="sep">/</span>
                    <span className="here">역할 및 권한</span>
                </div>
                <div className="spacer" />
                <label className="topsearch">
                    <SearchIcon />
                    <input
                        id="topSearch"
                        onChange={(event) => changeFilter(event.target.value)}
                        placeholder="역할·멤버 검색…"
                        type="text"
                        value={filter}
                    />
                    <kbd>/</kbd>
                </label>
                <button className="new-btn" onClick={createRole} type="button">
                    <PlusIcon />
                    새 역할
                </button>
                <div className="avatar">JS</div>
            </header>

            <div className="body">
                <nav className="rail">
                    <Link aria-label="작품" href="/studio/products" title="작품">
                        <SvgIcon>{RES[0].icon}</SvgIcon>
                    </Link>
                    <Link aria-label="에피소드" href="/studio/products/1/episodes" title="에피소드">
                        <SvgIcon>{RES[1].icon}</SvgIcon>
                    </Link>
                    <Link aria-label="성우" href="/studio/products/1/artists" title="성우">
                        <SvgIcon>{RES[3].icon}</SvgIcon>
                    </Link>
                    <button className="active" title="역할 및 권한" type="button">
                        <SvgIcon>{RES[7].icon}</SvgIcon>
                    </button>
                    <div className="rail-spacer" />
                    <button title="설정" type="button">
                        <SettingsIcon />
                    </button>
                </nav>

                <div className="work">
                    <div className="work-head">
                        <span className="wh-title">접근 제어</span>
                        <div className="tabs">
                            <button className={`tab${tab === 'roles' ? ' on' : ''}`} onClick={() => switchTab('roles')} type="button">
                                역할<span className="cnt">{db.roles.length}</span>
                            </button>
                            <button
                                className={`tab${tab === 'members' ? ' on' : ''}`}
                                onClick={() => switchTab('members')}
                                type="button"
                            >
                                멤버<span className="cnt">{db.members.length}</span>
                            </button>
                        </div>
                        <div className="wh-actions">
                            <label className="ghost-search">
                                <SearchIcon />
                                <input
                                    onChange={(event) => changeFilter(event.target.value)}
                                    placeholder={tab === 'roles' ? '역할 필터…' : '멤버 필터…'}
                                    type="text"
                                    value={filter}
                                />
                            </label>
                            <button
                                className="btn primary"
                                onClick={tab === 'roles' ? createRole : () => showToast('멤버 초대는 곧 지원됩니다')}
                                type="button"
                            >
                                <PlusIcon />
                                <span>{tab === 'roles' ? '새 역할' : '멤버 초대'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="work-body">
                        <div className={`roles-pane${tab === 'roles' ? '' : ' hidden'}`}>
                            <div className="roles-list">
                                {db.roles.some((role) => role.system) ? (
                                    <>
                                        <div className="rl-section">시스템 역할</div>
                                        {filteredSystemRoles.map((role) => (
                                            <RoleCard
                                                db={db}
                                                key={role.id}
                                                onSelect={() => setSelectedRoleId(role.id)}
                                                role={role}
                                                selected={role.id === selectedRoleId}
                                            />
                                        ))}
                                    </>
                                ) : null}
                                <div className="rl-section">사용자 정의 역할</div>
                                {filteredCustomRoles.length ? (
                                    filteredCustomRoles.map((role) => (
                                        <RoleCard
                                            db={db}
                                            key={role.id}
                                            onSelect={() => setSelectedRoleId(role.id)}
                                            role={role}
                                            selected={role.id === selectedRoleId}
                                        />
                                    ))
                                ) : (
                                    <div className="empty-copy">아직 없습니다 · 새 역할을 만들어 보세요</div>
                                )}
                            </div>

                            <div className="role-detail">
                                {selectedRole ? (
                                    <>
                                        <div className="rd-head">
                                            <div className="rd-titlewrap">
                                                <input
                                                    className="rd-name"
                                                    disabled={selectedRole.system}
                                                    onChange={(event) => updateSelectedRole({ name: event.target.value })}
                                                    value={selectedRole.name}
                                                />
                                                <textarea
                                                    className="rd-desc"
                                                    disabled={selectedRole.system}
                                                    onChange={(event) => updateSelectedRole({ desc: event.target.value })}
                                                    placeholder="역할 설명…"
                                                    rows={1}
                                                    value={selectedRole.desc}
                                                />
                                            </div>
                                            <div className="actions">
                                                <button className="btn" onClick={() => duplicateRole(selectedRoleId)} type="button">
                                                    <CopyIcon />
                                                    복제
                                                </button>
                                                {selectedRole.system ? null : (
                                                    <button className="btn danger" onClick={() => deleteRole(selectedRoleId)} type="button">
                                                        <TrashIcon />
                                                        삭제
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rd-badges">
                                            <span className="badge">
                                                <b>{isFull(selectedRole) ? '*:*' : permCount(selectedRole)}</b> 권한
                                            </span>
                                            <span className="badge">
                                                <b>{memberCount(db, selectedRole.id)}</b> 명에게 배정
                                            </span>
                                            <span className="badge">{selectedRole.system ? '시스템 기본 역할' : '사용자 정의'}</span>
                                            {selectedRole.system ? <span className="badge lock">읽기 전용</span> : null}
                                        </div>

                                        {selectedRole.system ? (
                                            <div className="sys-banner">
                                                <LockIcon />
                                                시스템 기본 역할은 직접 수정할 수 없습니다. 복제한 뒤 편집하세요.
                                                <button className="btn primary sb-act" onClick={() => duplicateRole(selectedRoleId)} type="button">
                                                    복제해서 편집
                                                </button>
                                            </div>
                                        ) : null}

                                        <div className="panel-label">
                                            <span className="t">권한 묶음 프리셋</span>
                                            <span className="hint">
                                                {selectedRole.system ? '편집 가능한 역할에서 적용' : '클릭하면 해당 권한을 한 번에 추가합니다'}
                                            </span>
                                            <span className="line" />
                                        </div>
                                        <div className="preset-row">
                                            {PRESETS.map((preset) => (
                                                <button
                                                    className="preset"
                                                    disabled={selectedRole.system}
                                                    key={preset.id}
                                                    onClick={() => applyPreset(preset.id)}
                                                    type="button"
                                                >
                                                    <span className="pn">
                                                        <span className="pdot" style={{ background: preset.dot }} />
                                                        {preset.name}
                                                    </span>
                                                    <span className="pd">{preset.desc}</span>
                                                    <span className="pmeta">{preset.tokens}</span>
                                                </button>
                                            ))}
                                        </div>

                                        <div className="panel-label">
                                            <span className="t">권한 매트릭스</span>
                                            <span className="hint">리소스 × 액션</span>
                                            <span className="line" />
                                        </div>
                                        <div className="matrix-wrap">
                                            <table className="matrix">
                                                <thead>
                                                    <tr>
                                                        <th className="res-head">
                                                            <span className="rh">리소스 \ 액션</span>
                                                        </th>
                                                        {ACT.map((action) => (
                                                            <th className="act-col" key={action.id}>
                                                                <div className="an">{action.ko}</div>
                                                                <span className="ak">{action.id}</span>
                                                                {selectedRole.system ? null : (
                                                                    <button className="col-all" onClick={() => toggleColumn(action.id)} type="button">
                                                                        전체
                                                                    </button>
                                                                )}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {RES.map((resource) => (
                                                        <tr key={resource.id}>
                                                            <td className="res-cell">
                                                                <div className="rc-name">
                                                                    <span className="ricon">
                                                                        <SvgIcon>{resource.icon}</SvgIcon>
                                                                    </span>
                                                                    <div>
                                                                        <div className="rl-ko">{resource.ko}</div>
                                                                        <div className="rl-en">{resource.en}</div>
                                                                        {selectedRole.system ? null : (
                                                                            <button className="row-all" onClick={() => toggleRow(resource.id)} type="button">
                                                                                전체 선택
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {ACT.map((action) => {
                                                                const selected = selectedRole.perms[resource.id][action.id];

                                                                return (
                                                                    <td className="perm" key={action.id}>
                                                                        <button
                                                                            aria-pressed={selected}
                                                                            className={`cell${selected ? ' on' : ''}`}
                                                                            disabled={selectedRole.system}
                                                                            onClick={() => togglePermissionCell(resource.id, action.id)}
                                                                            type="button"
                                                                        >
                                                                            <CheckIcon />
                                                                        </button>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="token-box">
                                            <div className="tb-head">
                                                <span className="t">정책 토큰</span>
                                                <span className="c">
                                                    {isFull(selectedRole) ? '*:*' : `${permCount(selectedRole)} statements`}
                                                </span>
                                            </div>
                                            <div className="tok-list">
                                                {tokenSummary(selectedRole).map((token) => (
                                                    <span className={`tok${token === '*:*' ? ' star' : ''}`} key={token}>
                                                        {token}
                                                    </span>
                                                ))}
                                                {tokenSummary(selectedRole).length === 0 ? <span className="tok none">권한 없음</span> : null}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="rd-empty">역할을 선택하세요</div>
                                )}
                            </div>
                        </div>

                        <div className={`members-wrap${tab === 'members' ? '' : ' hidden'}`}>
                            <table className="mtable">
                                <thead>
                                    <tr>
                                        <th style={{ width: '28%' }}>멤버</th>
                                        <th style={{ width: '34%' }}>배정된 역할</th>
                                        <th>유효 권한</th>
                                        <th style={{ width: 120 }}>상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMembers.map((member) => {
                                        const effective = effectivePerms(db, member);

                                        return (
                                            <tr key={member.id}>
                                                <td>
                                                    <div className="m-person">
                                                        <span className="m-av" style={{ background: member.av }}>
                                                            {member.initials}
                                                        </span>
                                                        <div>
                                                            <div className="m-name">{member.name}</div>
                                                            <div className="m-mail">{member.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="role-chips">
                                                        {member.roleIds.length ? (
                                                            member.roleIds.map((roleId) => {
                                                                const role = roleById(db, roleId);
                                                                if (!role) return null;

                                                                return (
                                                                    <span className="role-chip" key={roleId}>
                                                                        <span className="cdot" style={{ background: role.color }} />
                                                                        {role.name}
                                                                        <button
                                                                            className="rm"
                                                                            onClick={() => unassignRole(member.id, roleId)}
                                                                            title="해제"
                                                                            type="button"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </span>
                                                                );
                                                            })
                                                        ) : (
                                                            <span className="role-chip empty">역할 없음</span>
                                                        )}
                                                        <button
                                                            className="add-role"
                                                            onClick={(event) => {
                                                                const rect = event.currentTarget.getBoundingClientRect();
                                                                setAssignMenu({
                                                                    memberId: member.id,
                                                                    left: Math.min(rect.left, window.innerWidth - 212),
                                                                    top: rect.bottom + 6,
                                                                });
                                                            }}
                                                            type="button"
                                                        >
                                                            ＋ 역할
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="m-perm">
                                                        {effective.full ? '*:* (전체)' : `${effective.count} 권한 · ${effective.res} 리소스`}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`m-active${member.active ? '' : ' off'}`}>
                                                        <span className="ad" />
                                                        {member.active ? '활성' : '비활성'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {assignMenu ? (
                <div className="menu" style={{ left: assignMenu.left, top: assignMenu.top }}>
                    {db.roles.map((role) => {
                        const member = db.members.find((item) => item.id === assignMenu.memberId);
                        const assigned = member?.roleIds.includes(role.id) ?? false;

                        return (
                            <button className="mi" key={role.id} onClick={() => toggleMemberRole(assignMenu.memberId, role.id)} type="button">
                                <span className="cdot" style={{ background: role.color }} />
                                {role.name}
                                {assigned ? <span className="chk">✓</span> : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}

            <div className={`toast${toastMessage ? ' show' : ''}`}>
                <span className="td" />
                <span>{toastMessage}</span>
            </div>
        </main>
    );
}

function RoleCard({ db, onSelect, role, selected }: { db: AdminDb; onSelect: () => void; role: AdminRole; selected: boolean }) {
    return (
        <button className={`role-card${selected ? ' sel' : ''}`} onClick={onSelect} type="button">
            <div className="rc-top">
                <span className="dot" style={{ background: role.color }} />
                <span className="nm">{role.name}</span>
                <span className="sys">{role.system ? '시스템' : '사용자'}</span>
            </div>
            <div className="desc">{role.desc}</div>
            <div className="meta">
                <span>
                    <b>{isFull(role) ? '*:*' : permCount(role)}</b> 권한
                </span>
                <span>
                    <b>{memberCount(db, role.id)}</b> 멤버
                </span>
            </div>
        </button>
    );
}

function seed(): AdminDb {
    const adminPerms = grantAll(emptyPerms());
    const directorPerms = emptyPerms();
    grant(directorPerms, ['project', 'episode', 'canvas', 'record', 'artist', 'character', 'export'], [
        'view',
        'create',
        'edit',
        'delete',
    ]);
    grant(directorPerms, ['admin'], ['view']);
    const editorPerms = emptyPerms();
    grant(editorPerms, ['project', 'episode', 'canvas', 'character'], ['view', 'create', 'edit']);
    grant(editorPerms, ['record', 'artist'], ['view']);
    grant(editorPerms, ['export'], ['view', 'create']);
    const artistPerms = emptyPerms();
    grant(artistPerms, ['record'], ['view', 'create', 'edit']);
    grant(artistPerms, ['artist', 'character', 'episode'], ['view']);
    const viewerPerms = emptyPerms();
    grant(viewerPerms, allResourceIds(), ['view']);
    viewerPerms.admin.view = false;

    return {
        roles: [
            {
                id: 'r_admin',
                name: '관리자',
                color: '#4d8dff',
                system: true,
                desc: '모든 리소스에 대한 전체 권한. 멤버·권한을 관리합니다.',
                perms: adminPerms,
            },
            {
                id: 'r_director',
                name: '디렉터',
                color: '#2dd4bf',
                system: true,
                desc: '제작 전반을 총괄. 멤버·권한은 조회만 가능합니다.',
                perms: directorPerms,
            },
            {
                id: 'r_editor',
                name: '편집자',
                color: '#a78bfa',
                system: false,
                desc: '스토리·캔버스·캐릭터를 구성하고 편집합니다.',
                perms: editorPerms,
            },
            {
                id: 'r_artist',
                name: '성우',
                color: '#f472b6',
                system: false,
                desc: '배정된 컷을 녹음하고 본인 테이크를 관리합니다.',
                perms: artistPerms,
            },
            {
                id: 'r_viewer',
                name: '뷰어',
                color: '#fbbf24',
                system: false,
                desc: 'product 조회 — 결과물을 열람만 합니다.',
                perms: viewerPerms,
            },
        ],
        members: [
            { id: 'm1', name: '김지수', email: 'jisoo@dobedub.com', initials: 'JS', av: '#3157c4', roleIds: ['r_admin'], active: true },
            {
                id: 'm2',
                name: '박서연',
                email: 'seoyeon@dobedub.com',
                initials: 'SY',
                av: '#0d9488',
                roleIds: ['r_director'],
                active: true,
            },
            { id: 'm3', name: '이도현', email: 'dohyun@dobedub.com', initials: 'DH', av: '#7c3aed', roleIds: ['r_editor'], active: true },
            { id: 'm4', name: '최민준', email: 'minjun@dobedub.com', initials: 'MJ', av: '#be185d', roleIds: ['r_artist'], active: true },
            {
                id: 'm5',
                name: '한유나',
                email: 'yuna@dobedub.com',
                initials: 'YN',
                av: '#b45309',
                roleIds: ['r_viewer', 'r_artist'],
                active: true,
            },
            { id: 'm6', name: '정태경', email: 'taekyung@dobedub.com', initials: 'TK', av: '#475569', roleIds: [], active: false },
        ],
    };
}

function normalizeDb(value: unknown): AdminDb | undefined {
    if (!value || typeof value !== 'object') return undefined;

    const maybeDb = value as Partial<AdminDb>;
    if (!Array.isArray(maybeDb.roles) || maybeDb.roles.length === 0) return undefined;
    if (!Array.isArray(maybeDb.members)) return undefined;

    return {
        roles: maybeDb.roles.map((role) => ({
            ...role,
            perms: normalizePerms(role.perms),
        })),
        members: maybeDb.members,
    };
}

function normalizePerms(perms?: PermissionMap): PermissionMap {
    const normalized = emptyPerms();

    RES.forEach((resource) => {
        ACT.forEach((action) => {
            normalized[resource.id][action.id] = Boolean(perms?.[resource.id]?.[action.id]);
        });
    });

    return normalized;
}

function allResourceIds() {
    return RES.map((resource) => resource.id);
}

function emptyPerms() {
    const perms = {} as PermissionMap;

    RES.forEach((resource) => {
        perms[resource.id] = {} as Record<ActionId, boolean>;
        ACT.forEach((action) => {
            perms[resource.id][action.id] = false;
        });
    });

    return perms;
}

function clonePerms(perms: PermissionMap) {
    const cloned = emptyPerms();

    RES.forEach((resource) => {
        ACT.forEach((action) => {
            cloned[resource.id][action.id] = perms[resource.id][action.id];
        });
    });

    return cloned;
}

function grant(perms: PermissionMap, resourceIds: ResourceId[], actionIds: ActionId[]) {
    resourceIds.forEach((resourceId) => {
        actionIds.forEach((actionId) => {
            perms[resourceId][actionId] = true;
        });
    });

    return perms;
}

function grantAll(perms: PermissionMap) {
    RES.forEach((resource) => {
        ACT.forEach((action) => {
            perms[resource.id][action.id] = true;
        });
    });

    return perms;
}

function roleById(db: AdminDb, roleId: string | null) {
    return db.roles.find((role) => role.id === roleId);
}

function permCount(role: AdminRole) {
    return RES.reduce((resourceTotal, resource) => {
        return resourceTotal + ACT.filter((action) => role.perms[resource.id][action.id]).length;
    }, 0);
}

function isFull(role: AdminRole) {
    return permCount(role) === RES.length * ACT.length;
}

function memberCount(db: AdminDb, roleId: string) {
    return db.members.filter((member) => member.roleIds.includes(roleId)).length;
}

function tokenSummary(role: AdminRole) {
    if (isFull(role)) return ['*:*'];

    return RES.flatMap((resource) => {
        const actions = ACT.filter((action) => role.perms[resource.id][action.id]).map((action) => action.id);
        if (actions.length === 0) return [];
        if (actions.length === ACT.length) return [`${resource.id}:*`];

        return actions.map((action) => `${resource.id}:${action}`);
    });
}

function effectivePerms(db: AdminDb, member: AdminMember) {
    const perms = emptyPerms();

    member.roleIds.forEach((roleId) => {
        const role = roleById(db, roleId);
        if (!role) return;

        RES.forEach((resource) => {
            ACT.forEach((action) => {
                if (role.perms[resource.id][action.id]) {
                    perms[resource.id][action.id] = true;
                }
            });
        });
    });

    const resourceIds = new Set<ResourceId>();
    let count = 0;
    RES.forEach((resource) => {
        ACT.forEach((action) => {
            if (perms[resource.id][action.id]) {
                count += 1;
                resourceIds.add(resource.id);
            }
        });
    });

    return {
        full: count === RES.length * ACT.length,
        count,
        res: resourceIds.size,
    };
}

function matchesRole(role: AdminRole, filter: string) {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return true;

    return `${role.name} ${role.desc}`.toLowerCase().includes(normalized);
}

function matchesMember(member: AdminMember, filter: string) {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return true;

    return `${member.name} ${member.email}`.toLowerCase().includes(normalized);
}

function getNextRoleName(roles: AdminRole[]) {
    let index = 1;
    let name = `새 역할 ${index}`;

    while (roles.some((role) => role.name === name)) {
        index += 1;
        name = `새 역할 ${index}`;
    }

    return name;
}

function SvgIcon({ children }: { children: ReactNode }) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            {children}
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4-4" />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}

function CopyIcon() {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect height="11" rx="2" width="11" x="9" y="9" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
        </svg>
    );
}

function LockIcon() {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect height="9" rx="2" width="14" x="5" y="11" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
            <path d="m5 12 5 5L20 6" />
        </svg>
    );
}

function SettingsIcon() {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.1-1.4l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.4-1.4l-.3-2.6H9.2l-.3 2.6a7 7 0 0 0-2.4 1.4l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.4 1.4l.3 2.6h2.6l.3-2.6a7 7 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12Z" />
        </svg>
    );
}
