import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AppData, defaultAppData, mergeAppData } from "../../../lib/app-data";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length);
}

function createUserClient(token: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env vars are missing");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedClient(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = createUserClient(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  return { supabase, userId: user.id, userEmail: user.email ?? "", userName };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ("error" in auth) return auth.error;

  const { supabase, userId, userEmail, userName } = auth;
  const { data, error } = await supabase.from("app_data").select("*").eq("user_id", userId).maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    const defaults = mergeAppData({
      profile_data: {
        ...defaultAppData.profile_data,
        name: userName || defaultAppData.profile_data.name,
        shortName: userName?.split(" ")[0] || defaultAppData.profile_data.shortName,
        email: userEmail || defaultAppData.profile_data.email,
      },
    });

    const { error: insertError } = await supabase.from("app_data").insert({
      user_id: userId,
      habits: defaults.habits,
      tasks: defaults.tasks,
      streaks: defaults.streaks,
      journal: defaults.journal,
      settings: defaults.settings,
      language: defaults.language,
      profile_data: defaults.profile_data,
      finance: defaults.finance,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(defaults);
  }

  return NextResponse.json(
    mergeAppData({
      habits: data.habits,
      tasks: data.tasks,
      streaks: data.streaks,
      journal: data.journal,
      settings: data.settings,
      language: data.language,
      profile_data: data.profile_data,
      finance: data.finance,
    }),
  );
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ("error" in auth) return auth.error;

  const { supabase, userId } = auth;
  const body = mergeAppData((await request.json()) as Partial<AppData>);

  const { error } = await supabase.from("app_data").upsert({
    user_id: userId,
    habits: body.habits,
    tasks: body.tasks,
    streaks: body.streaks,
    journal: body.journal,
    settings: body.settings,
    language: body.language,
    profile_data: body.profile_data,
    finance: body.finance,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
