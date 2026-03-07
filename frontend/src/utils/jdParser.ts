// Pattern-based extractors

export interface JDStructure {
    positionTitle: string | null;
    rank: string | null;
    department: string | null;
    institution: string | null;
    required: {
        education: any[];
        publications: any[];
        teaching: any[];
        experience: any[];
    };
    preferred: {
        grants: any[];
        service: any[];
        other: any[];
    };
    responsibilities: string[];
    positionType: 'research_intensive' | 'teaching_focused' | 'balanced';
}

export function extractJDStructure(text: string): JDStructure {
    const structure: JDStructure = {
        positionTitle: extractPositionTitle(text),
        rank: extractRank(text),
        department: extractDepartment(text),
        institution: extractInstitution(text),

        required: {
            education: extractEducationReqs(text),
            publications: extractPublicationReqs(text),
            teaching: extractTeachingReqs(text),
            experience: extractExperienceReqs(text)
        },

        preferred: {
            grants: extractGrantPrefs(text),
            service: extractServicePrefs(text),
            other: extractOtherPrefs(text)
        },

        responsibilities: extractResponsibilities(text),
        positionType: detectPositionType(text)
    };

    return structure;
}

function extractPositionTitle(text: string) {
    const patterns = [
        /Position\s*[:\-]\s*(.+?)(?:\n|$)/i,
        /Title\s*[:\-]\s*(.+?)(?:\n|$)/i,
        /Job Title\s*[:\-]\s*(.+?)(?:\n|$)/i,
        /^(.+?(?:Professor|Lecturer|Instructor|Postdoctoral|Researcher|Dean|Chair).+?)(?:\n|$)/im
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
    }
    return null;
}

function extractRank(text: string) {
    const match = text.match(/(Assistant|Associate|Full|Distinguished)\s+Professor/i);
    return match ? match[0] : null;
}

function extractDepartment(text: string) {
    const match = text.match(/(?:Department|School|College)\s+of\s+([A-Z][a-z\s&,]+)(?:\n|$)/i);
    return match ? match[0].trim() : null;
}

function extractInstitution(text: string) {
    const match = text.match(/(?:University|Institute|College)\s+.*?(?:\n|$)/i);
    return match ? match[0].trim() : null;
}

function extractEducationReqs(text: string) {
    const requirements = [];
    if (/Ph\.?D\.?/i.test(text) || /Doctorate/i.test(text)) {
        requirements.push({ type: 'degree', value: 'PhD/Doctorate', raw: 'Ph.D. or Doctorate requires' });
    }
    if (/Master'?s?/i.test(text) || /M\.?S\.?/i.test(text)) {
        requirements.push({ type: 'degree', value: "Master's", raw: "Master's degree preferred or required" });
    }
    return requirements;
}

function extractPublicationReqs(text: string) {
    const patterns = [
        /(?:minimum|at least)\s+(\d+)\s+(?:publications?|papers?)/i,
        /(\d+)\+?\s+(?:publications?|papers?)\s+(?:in|from)\s+(?:Q1|A\*|top-tier)/i,
        /h-index\s*(?:of|≥|>=|>)\s*(\d+)/i
    ];
    const requirements = [];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            requirements.push({
                type: 'publication_count',
                value: parseInt(match[1]),
                raw: match[0]
            });
        }
    }
    return requirements;
}

function extractTeachingReqs(text: string) {
    const requirements = [];
    const expMatch = text.match(/(?:minimum|at least)\s+(\d+)\s+(?:years?\s+)?(?:of\s+)?teaching/i);
    if (expMatch) {
        requirements.push({ type: 'teaching_experience', value: parseInt(expMatch[1]), raw: expMatch[0] });
    }
    return requirements;
}

function extractExperienceReqs(text: string) {
    const requirements = [];
    const expMatch = text.match(/(\d+)\+?\s*(?:years?\s+)?(?:of\s+)?experience/i);
    if (expMatch) {
        requirements.push({ type: 'experience', value: parseInt(expMatch[1]), raw: expMatch[0] });
    }
    return requirements;
}

function extractGrantPrefs(text: string) {
    const prefs = [];
    if (/grant/i.test(text)) {
        prefs.push({ type: 'grants', raw: 'Ability to secure external funding or grants' });
    }
    return prefs;
}

function extractServicePrefs(text: string) {
    const prefs = [];
    if (/service/i.test(text)) {
        prefs.push({ type: 'service', raw: 'Service to department, university, or profession' });
    }
    return prefs;
}

function extractOtherPrefs(_text: string) {
    return [];
}

function extractResponsibilities(_text: string) {
    return [];
}

function detectPositionType(text: string): 'research_intensive' | 'teaching_focused' | 'balanced' {
    const researchKeywords = ['research', 'publications', 'grants', 'h-index', 'citations', 'lab', 'funding'];
    const teachingKeywords = ['teaching', 'courses', 'students', 'pedagogy', 'curriculum', 'undergraduate', 'instruction'];

    const textLower = text.toLowerCase();

    const researchScore = researchKeywords.reduce((score, keyword) => {
        return score + (textLower.match(new RegExp(keyword, 'g')) || []).length;
    }, 0);

    const teachingScore = teachingKeywords.reduce((score, keyword) => {
        return score + (textLower.match(new RegExp(keyword, 'g')) || []).length;
    }, 0);

    if (researchScore > teachingScore * 1.5) return 'research_intensive';
    if (teachingScore > researchScore * 1.5) return 'teaching_focused';
    return 'balanced';
}
