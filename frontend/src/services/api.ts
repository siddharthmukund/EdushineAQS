import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import type {
    ApiResponse, AnalysisResult,
    CommitteeResponse, CommitteeJoinResponse, VoteTallyResponse, CommentItem,
    InterviewPrepResponse, TokenResponse, LoginResponse,
    CandidateProfile, JobPosting, JobApplication,
    AppRegisterResponse,
    UserProfile, UserSession, AuditLog, UserInvitation,
    MFASetupResponse, UserRole, OAuthProvider, NotificationPreferences,
} from '../types/api';

export type {
    UserProfile, UserSession, AuditLog, UserInvitation,
    MFASetupResponse, LoginResponse, UserRole, OAuthProvider, NotificationPreferences,
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000, // 60s for LLM processing
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: attach JWT from authStore (falls back to dev key)
apiClient.interceptors.request.use((config) => {
    let token: string | null = null;
    try {
        token = useAuthStore.getState().token;
    } catch { /* store not yet initialised */ }
    if (!token) token = localStorage.getItem('api_key') || 'development-key';
    config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Response interceptor: auto-logout on 401
apiClient.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            try {
                useAuthStore.getState().logout();
            } catch { /* ignore */ }
        }
        return Promise.reject(err);
    },
);

export const analyzeCV = async (
    cvFile: File,
    jobDescription?: string,
    model?: string
): Promise<AnalysisResult> => {
    const formData = new FormData();
    formData.append('cv_file', cvFile);
    if (jobDescription) {
        formData.append('job_description', jobDescription);
    }
    if (model) {
        formData.append('model', model);
    }

    const response = await apiClient.post<ApiResponse<AnalysisResult>>(
        '/api/analyze',
        formData,
        {
            headers: { 'Content-Type': 'multipart/form-data' },
        }
    );

    if (response.data.status !== 'success') {
        throw new Error(response.data.error?.message || 'Unknown error');
    }

    return response.data.data;
};

// Batch Analysis APIs

export interface BatchJobResponse {
    batch_id: string;
    cv_count: number;
    status: string;
    estimated_completion_minutes: number;
    websocket_url: string;
}

export interface BatchStatusResponse {
    batch_id: string;
    cv_count: number;
    completed_count: number;
    status: string;
    total_cost_usd: number;
    created_at: string;
    completed_at: string | null;
}

export const batchAnalyze = async (
    cvFiles: File[],
    jobDescription: string | File,
    llmProvider: string = 'claude-3-5-sonnet-20241022'
): Promise<BatchJobResponse> => {
    const formData = new FormData();

    cvFiles.forEach((file) => {
        formData.append('cv_files', file);
    });

    if (typeof jobDescription === 'string') {
        formData.append('job_description', jobDescription);
    } else {
        formData.append('job_description_file', jobDescription);
    }

    formData.append('llm_provider', llmProvider);

    const response = await apiClient.post<BatchJobResponse>(
        '/api/batch',
        formData,
        {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000, // 2 minutes for upload
        }
    );

    return response.data;
};

export const getBatchStatus = async (batchId: string): Promise<BatchStatusResponse> => {
    const response = await apiClient.get<BatchStatusResponse>(
        `/api/batch/${batchId}`
    );
    return response.data;
};

export interface BatchResultsResponse {
    batch_id: string;
    status: string;
    cv_count: number;
    completed_count: number;
    total_cost_usd: number;
    results: AnalysisResult[];
}

export const getBatchResults = async (batchId: string): Promise<BatchResultsResponse> => {
    const response = await apiClient.get<BatchResultsResponse>(
        `/api/batch/${batchId}/results`
    );
    return response.data;
};

// Analytics APIs

export interface SuccessPredictionResponse {
    status: string;
    candidate_id: string;
    candidate_name: string;
    prediction: {
        success_probability_percent: number;
        expected_tenure_years: number;
        risk_factors: string[];
        success_drivers: string[];
        model_confidence: string;
    }
}

export const getSuccessPrediction = async (analysisId: string): Promise<SuccessPredictionResponse> => {
    const response = await apiClient.get<SuccessPredictionResponse>(
        `/api/analytics/candidate/${analysisId}/success-prediction`
    );
    return response.data;
};

export interface DiversityAnalyticsResponse {
    status: string;
    batch_id: string;
    analytics: {
        total_candidates_analyzed: number;
        institutional_diversity: {
            unique_institutions: number;
            score: number;
        };
        simulated_demographics: {
            gender: { female: number; male: number; non_binary_or_undisclosed: number };
            ethnicity: { underrepresented: number; majority: number; undisclosed: number };
        };
        inclusivity_index: number;
        systemic_bias_warnings: string[];
        recommendation: string;
    }
}

export const getDiversityAnalytics = async (batchId: string): Promise<DiversityAnalyticsResponse> => {
    const response = await apiClient.get<DiversityAnalyticsResponse>(
        `/api/analytics/batch/${batchId}/diversity`
    );
    return response.data;
};

// ---------------------------------------------------------------------------
// Interview Prep
// ---------------------------------------------------------------------------

export const getInterviewPrep = async (analysisId: string): Promise<InterviewPrepResponse> => {
    const response = await apiClient.get<InterviewPrepResponse>(
        `/api/analyze/${analysisId}/interview-prep`
    );
    return response.data;
};

// ---------------------------------------------------------------------------
// Committee Collaboration
// ---------------------------------------------------------------------------

export const createCommittee = async (
    batchId: string,
    name: string,
    creatorName: string,
    creatorEmail: string,
): Promise<CommitteeResponse> => {
    const response = await apiClient.post<CommitteeResponse>('/api/committee', {
        batch_id: batchId,
        name,
        creator_name: creatorName,
        creator_email: creatorEmail,
    });
    return response.data;
};

export const joinCommittee = async (
    committeeId: string,
    name: string,
    email: string,
): Promise<CommitteeJoinResponse> => {
    const response = await apiClient.post<CommitteeJoinResponse>(
        `/api/committee/${committeeId}/join`,
        { name, email },
    );
    return response.data;
};

export const submitVote = async (
    committeeId: string,
    candidateId: string,
    vote: string,
    sessionToken: string,
    comment?: string,
): Promise<void> => {
    await apiClient.post(
        `/api/committee/${committeeId}/vote`,
        { candidate_id: candidateId, vote, comment },
        { headers: { Authorization: `Bearer ${sessionToken}` } },
    );
};

export const getVotes = async (committeeId: string, candidateId: string): Promise<VoteTallyResponse> => {
    const response = await apiClient.get<VoteTallyResponse>(
        `/api/committee/${committeeId}/votes/${candidateId}`
    );
    return response.data;
};

export const addComment = async (
    committeeId: string,
    candidateId: string,
    comment: string,
    sessionToken: string,
    parentId?: string,
): Promise<CommentItem> => {
    const response = await apiClient.post<CommentItem>(
        `/api/committee/${committeeId}/comment`,
        { candidate_id: candidateId, comment, parent_id: parentId },
        { headers: { Authorization: `Bearer ${sessionToken}` } },
    );
    return response.data;
};

export const getComments = async (committeeId: string, candidateId: string): Promise<{ comments: CommentItem[] }> => {
    const response = await apiClient.get<{ comments: CommentItem[] }>(
        `/api/committee/${committeeId}/comments/${candidateId}`
    );
    return response.data;
};

// ---------------------------------------------------------------------------
// Auth (ICCV #3 — expanded)
// ---------------------------------------------------------------------------

export const authRegister = async (
    email: string, name: string, password: string, invite_token?: string
): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/register', {
        email, name, password, ...(invite_token ? { invite_token } : {}),
    });
    return response.data;
};

/** Returns either a full TokenResponse or {mfa_required: true, temp_token} */
export const authLogin = async (email: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    return response.data;
};

export const authMFAVerify = async (
    temp_token: string, code: string, use_recovery_code = false
): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/mfa-verify', {
        temp_token, code, use_recovery_code,
    });
    return response.data;
};

export const authLogout = async (): Promise<void> => {
    await apiClient.post('/auth/logout');
};

export const authGetMe = async (): Promise<UserProfile> => {
    const response = await apiClient.get<UserProfile>('/auth/me');
    return response.data;
};

export const authOAuthGetUrl = async (provider: OAuthProvider): Promise<{ url: string; state: string }> => {
    const response = await apiClient.get<{ url: string; state: string }>(`/auth/oauth/${provider}`);
    return response.data;
};

export const authCheckInvite = async (token: string): Promise<{ email: string; role: UserRole }> => {
    const response = await apiClient.post<{ email: string; role: UserRole }>(`/auth/invite/${token}/check`);
    return response.data;
};

// ---------------------------------------------------------------------------
// Candidate Platform
// ---------------------------------------------------------------------------

export const createCandidateProfile = async (data: {
    email: string; name: string; institution?: string; orcid_id?: string;
    h_index?: number; research_areas?: string[]; bio?: string; job_preferences?: Record<string, any>;
}): Promise<{ status: string; profile: CandidateProfile }> => {
    const response = await apiClient.post('/api/candidate/profile', data);
    return response.data;
};

export const getCandidateProfileByEmail = async (email: string): Promise<{ status: string; profile: CandidateProfile } | null> => {
    try {
        const response = await apiClient.get(`/api/candidate/profile/me`, { params: { email } });
        return response.data;
    } catch {
        return null;
    }
};

export const updateCandidateProfile = async (
    profileId: string, data: Partial<CandidateProfile>
): Promise<{ status: string; profile: CandidateProfile }> => {
    const response = await apiClient.put(`/api/candidate/profile/${profileId}`, data);
    return response.data;
};

export const verifyORCID = async (
    profileId: string, orcidId: string
): Promise<{ status: string; profile: CandidateProfile; orcid_parsed: Record<string, any> }> => {
    const response = await apiClient.post(`/api/candidate/profile/${profileId}/verify-orcid`, { orcid_id: orcidId });
    return response.data;
};

export const listJobPostings = async (positionType?: string): Promise<{ status: string; jobs: JobPosting[] }> => {
    const response = await apiClient.get('/api/candidate/jobs', { params: positionType ? { position_type: positionType } : {} });
    return response.data;
};

export const createJobPosting = async (data: {
    title: string; institution: string; position_type: string; description: string;
    created_by_email: string; department?: string; requirements?: Record<string, any>;
    salary_range?: Record<string, any>; location?: string; deadline?: string;
}): Promise<{ status: string; job: JobPosting }> => {
    const response = await apiClient.post('/api/candidate/jobs', data);
    return response.data;
};

export const applyToJob = async (
    jobId: string,
    data: { candidate_profile_id: string; analysis_id?: string; cover_note?: string }
): Promise<{ status: string; application: JobApplication }> => {
    const response = await apiClient.post(`/api/candidate/jobs/${jobId}/apply`, data);
    return response.data;
};

export const getMyApplications = async (email: string): Promise<{ status: string; applications: JobApplication[] }> => {
    const response = await apiClient.get('/api/candidate/applications', { params: { email } });
    return response.data;
};

export const updateApplicationStatus = async (
    applicationId: string, status: string, note?: string
): Promise<{ status: string; application: JobApplication }> => {
    const response = await apiClient.put(`/api/candidate/applications/${applicationId}/status`, { status, note });
    return response.data;
};

// ---------------------------------------------------------------------------
// Developer Ecosystem / Marketplace
// ---------------------------------------------------------------------------

export const registerDeveloperApp = async (data: {
    name: string; developer_email: string; description?: string;
    webhook_url?: string; category?: string;
}): Promise<AppRegisterResponse> => {
    const response = await apiClient.post('/api/v1/public/apps/register', data);
    return response.data;
};

export const getMarketplaceApps = async (category?: string): Promise<{ status: string; apps: any[] }> => {
    const response = await apiClient.get('/api/v1/public/marketplace', { params: category ? { category } : {} });
    return response.data;
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const updateApiKeys = async (keys: {
    anthropic?: string;
    openai?: string;
    gemini?: string;
}): Promise<{ status: string; message: string }> => {
    const response = await apiClient.post('/api/settings/keys', keys);
    return response.data;
};

// ---------------------------------------------------------------------------
// User Profile / MFA / Sessions (ICCV #3)
// ---------------------------------------------------------------------------

export const getUserProfile = async (): Promise<UserProfile> => {
    const response = await apiClient.get<UserProfile>('/api/user/profile');
    return response.data;
};

export const updateUserProfile = async (data: {
    name?: string; avatar_url?: string; timezone?: string;
    language_preference?: string; department?: string; title?: string;
}): Promise<UserProfile> => {
    const response = await apiClient.put<UserProfile>('/api/user/profile', data);
    return response.data;
};

export const updateUserPreferences = async (
    notification_preferences: NotificationPreferences
): Promise<{ ok: boolean }> => {
    const response = await apiClient.put('/api/user/preferences', { notification_preferences });
    return response.data;
};

export const setupMFA = async (): Promise<MFASetupResponse> => {
    const response = await apiClient.post<MFASetupResponse>('/api/user/mfa/setup');
    return response.data;
};

export const confirmMFA = async (code: string): Promise<{ ok: boolean; mfa_enabled: boolean }> => {
    const response = await apiClient.post('/api/user/mfa/confirm', { code });
    return response.data;
};

export const disableMFA = async (code: string): Promise<{ ok: boolean; mfa_enabled: boolean }> => {
    const response = await apiClient.post('/api/user/mfa/disable', { code });
    return response.data;
};

export const getMySessions = async (): Promise<UserSession[]> => {
    const response = await apiClient.get<UserSession[]>('/api/user/sessions');
    return response.data;
};

export const revokeSession = async (sessionId: string): Promise<{ ok: boolean }> => {
    const response = await apiClient.delete(`/api/user/sessions/${sessionId}`);
    return response.data;
};

export const revokeAllSessions = async (): Promise<{ ok: boolean; revoked: number }> => {
    const response = await apiClient.delete('/api/user/sessions');
    return response.data;
};

export const exportMyData = async (): Promise<{ exported_at: string; user: UserProfile; analyses: any[] }> => {
    const response = await apiClient.get('/api/user/export');
    return response.data;
};

// ---------------------------------------------------------------------------
// Admin (ICCV #3)
// ---------------------------------------------------------------------------

export interface AdminUserListResponse {
    total: number;
    page: number;
    per_page: number;
    users: UserProfile[];
}

export const adminListUsers = async (params?: {
    search?: string; role?: string; page?: number; per_page?: number;
}): Promise<AdminUserListResponse> => {
    const response = await apiClient.get<AdminUserListResponse>('/api/admin/users', { params });
    return response.data;
};

export const adminChangeUserRole = async (
    userId: string, role: UserRole
): Promise<{ ok: boolean; user_id: string; role: UserRole }> => {
    const response = await apiClient.put(`/api/admin/users/${userId}/role`, { role });
    return response.data;
};

export const adminToggleUserStatus = async (
    userId: string, is_active: boolean
): Promise<{ ok: boolean; user_id: string; is_active: boolean }> => {
    const response = await apiClient.put(`/api/admin/users/${userId}/status`, { is_active });
    return response.data;
};

export const adminSendInvitation = async (
    email: string, role: UserRole
): Promise<{ ok: boolean; invitation_id: string; invite_url: string }> => {
    const response = await apiClient.post('/api/admin/users/invite', { email, role });
    return response.data;
};

export const adminListInvitations = async (): Promise<UserInvitation[]> => {
    const response = await apiClient.get<UserInvitation[]>('/api/admin/invitations');
    return response.data;
};

export const adminRevokeInvitation = async (invitationId: string): Promise<{ ok: boolean }> => {
    const response = await apiClient.delete(`/api/admin/invitations/${invitationId}`);
    return response.data;
};

export const adminGetAuditLogs = async (params?: {
    user_id?: string; action?: string; from_date?: string;
    to_date?: string; limit?: number; offset?: number;
}): Promise<AuditLog[]> => {
    const response = await apiClient.get<AuditLog[]>('/api/admin/audit-logs', { params });
    return response.data;
};
