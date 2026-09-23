export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  orbit: {
    Tables: {
      _bak_clients_unconscious_desire_20260920: {
        Row: {
          avatar_unconscious_desire: string | null
          handle: string | null
          id: string | null
        }
        Insert: {
          avatar_unconscious_desire?: string | null
          handle?: string | null
          id?: string | null
        }
        Update: {
          avatar_unconscious_desire?: string | null
          handle?: string | null
          id?: string | null
        }
        Relationships: []
      }
      _bak_ig_audience_avatar_scores_20260920: {
        Row: {
          avatar_age_alignment_score: number | null
          avatar_gender_alignment_score: number | null
          avatar_geo_alignment_score: number | null
          id: string | null
        }
        Insert: {
          avatar_age_alignment_score?: number | null
          avatar_gender_alignment_score?: number | null
          avatar_geo_alignment_score?: number | null
          id?: string | null
        }
        Update: {
          avatar_age_alignment_score?: number | null
          avatar_gender_alignment_score?: number | null
          avatar_geo_alignment_score?: number | null
          id?: string | null
        }
        Relationships: []
      }
      _migration_audit_log: {
        Row: {
          applied_at: string
          detail: Json | null
          id: string
          migration_name: string
        }
        Insert: {
          applied_at?: string
          detail?: Json | null
          id?: string
          migration_name: string
        }
        Update: {
          applied_at?: string
          detail?: Json | null
          id?: string
          migration_name?: string
        }
        Relationships: []
      }
      ads_ga4_landing_pages: {
        Row: {
          avg_session_sec: number | null
          bounce_rate_pct: number | null
          client_id: string
          conversion_rate_pct: number | null
          conversions: number | null
          created_at: string
          cta_clicks: number | null
          engaged_sessions: number | null
          id: string
          page_path: string
          scroll_depth_50_pct: number | null
          sessions: number | null
          snapshot_date: string
          source_medium: string | null
        }
        Insert: {
          avg_session_sec?: number | null
          bounce_rate_pct?: number | null
          client_id: string
          conversion_rate_pct?: number | null
          conversions?: number | null
          created_at?: string
          cta_clicks?: number | null
          engaged_sessions?: number | null
          id?: string
          page_path: string
          scroll_depth_50_pct?: number | null
          sessions?: number | null
          snapshot_date: string
          source_medium?: string | null
        }
        Update: {
          avg_session_sec?: number | null
          bounce_rate_pct?: number | null
          client_id?: string
          conversion_rate_pct?: number | null
          conversions?: number | null
          created_at?: string
          cta_clicks?: number | null
          engaged_sessions?: number | null
          id?: string
          page_path?: string
          scroll_depth_50_pct?: number | null
          sessions?: number | null
          snapshot_date?: string
          source_medium?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_ga4_landing_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_ga4_landing_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_ga4_landing_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_ga4_landing_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_ga4_landing_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_ga4_landing_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_ga4_landing_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_google_campaigns: {
        Row: {
          channel_type: string
          client_id: string
          created_at: string
          daily_budget: number | null
          end_date: string | null
          google_campaign_id: string
          id: string
          name: string
          objective: Database["orbit"]["Enums"]["campaign_objective"] | null
          start_date: string | null
          status: Database["orbit"]["Enums"]["asset_status"]
          updated_at: string
        }
        Insert: {
          channel_type: string
          client_id: string
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          google_campaign_id: string
          id?: string
          name: string
          objective?: Database["orbit"]["Enums"]["campaign_objective"] | null
          start_date?: string | null
          status?: Database["orbit"]["Enums"]["asset_status"]
          updated_at?: string
        }
        Update: {
          channel_type?: string
          client_id?: string
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          google_campaign_id?: string
          id?: string
          name?: string
          objective?: Database["orbit"]["Enums"]["campaign_objective"] | null
          start_date?: string | null
          status?: Database["orbit"]["Enums"]["asset_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_google_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_google_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_google_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_google_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_google_search_terms: {
        Row: {
          campaign_id: string | null
          clicks: number | null
          client_id: string
          conversion_rate_pct: number | null
          conversions: number | null
          cost: number | null
          cost_per_conversion: number | null
          cpc: number | null
          created_at: string
          ctr_pct: number | null
          id: string
          impressions: number | null
          match_type: string | null
          search_term: string
          snapshot_date: string
        }
        Insert: {
          campaign_id?: string | null
          clicks?: number | null
          client_id: string
          conversion_rate_pct?: number | null
          conversions?: number | null
          cost?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          created_at?: string
          ctr_pct?: number | null
          id?: string
          impressions?: number | null
          match_type?: string | null
          search_term: string
          snapshot_date: string
        }
        Update: {
          campaign_id?: string | null
          clicks?: number | null
          client_id?: string
          conversion_rate_pct?: number | null
          conversions?: number | null
          cost?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          created_at?: string
          ctr_pct?: number | null
          id?: string
          impressions?: number | null
          match_type?: string | null
          search_term?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_google_search_terms_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_google_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_search_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_search_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_google_search_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_search_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_google_search_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_search_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_google_search_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_google_snapshots: {
        Row: {
          avg_cpc: number | null
          campaign_id: string | null
          clicks: number | null
          client_id: string
          confidence_level: Database["orbit"]["Enums"]["confidence_level"]
          conversion_rate_pct: number | null
          conversions: number | null
          cost_per_conversion: number | null
          created_at: string
          ctr_pct: number | null
          id: string
          impression_share: number | null
          impressions: number | null
          lost_is_budget_pct: number | null
          lost_is_rank_pct: number | null
          revenue: number | null
          roas: number | null
          snapshot_date: string
          spend: number | null
        }
        Insert: {
          avg_cpc?: number | null
          campaign_id?: string | null
          clicks?: number | null
          client_id: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          conversion_rate_pct?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          created_at?: string
          ctr_pct?: number | null
          id?: string
          impression_share?: number | null
          impressions?: number | null
          lost_is_budget_pct?: number | null
          lost_is_rank_pct?: number | null
          revenue?: number | null
          roas?: number | null
          snapshot_date: string
          spend?: number | null
        }
        Update: {
          avg_cpc?: number | null
          campaign_id?: string | null
          clicks?: number | null
          client_id?: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          conversion_rate_pct?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          created_at?: string
          ctr_pct?: number | null
          id?: string
          impression_share?: number | null
          impressions?: number | null
          lost_is_budget_pct?: number | null
          lost_is_rank_pct?: number | null
          revenue?: number | null
          roas?: number | null
          snapshot_date?: string
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_google_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_google_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_google_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_google_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_google_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_google_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_meta_adsets: {
        Row: {
          campaign_id: string
          created_at: string
          daily_budget: number | null
          id: string
          meta_adset_id: string
          name: string
          optimization_goal: string | null
          status: Database["orbit"]["Enums"]["asset_status"]
          targeting_summary: Json | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          daily_budget?: number | null
          id?: string
          meta_adset_id: string
          name: string
          optimization_goal?: string | null
          status?: Database["orbit"]["Enums"]["asset_status"]
          targeting_summary?: Json | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          daily_budget?: number | null
          id?: string
          meta_adset_id?: string
          name?: string
          optimization_goal?: string | null
          status?: Database["orbit"]["Enums"]["asset_status"]
          targeting_summary?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_meta_adsets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_meta_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_meta_campaigns: {
        Row: {
          budget_lifetime: number | null
          budget_monthly: number | null
          client_id: string
          created_at: string
          end_date: string | null
          id: string
          meta_campaign_id: string
          name: string
          objective: Database["orbit"]["Enums"]["campaign_objective"]
          start_date: string | null
          status: Database["orbit"]["Enums"]["asset_status"]
          updated_at: string
        }
        Insert: {
          budget_lifetime?: number | null
          budget_monthly?: number | null
          client_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          meta_campaign_id: string
          name: string
          objective: Database["orbit"]["Enums"]["campaign_objective"]
          start_date?: string | null
          status?: Database["orbit"]["Enums"]["asset_status"]
          updated_at?: string
        }
        Update: {
          budget_lifetime?: number | null
          budget_monthly?: number | null
          client_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          meta_campaign_id?: string
          name?: string
          objective?: Database["orbit"]["Enums"]["campaign_objective"]
          start_date?: string | null
          status?: Database["orbit"]["Enums"]["asset_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_meta_creatives: {
        Row: {
          adset_id: string
          client_id: string
          created_at: string
          creative_health: string | null
          ctr_pct_current: number | null
          ctr_pct_week1: number | null
          fatigue_cause: string | null
          fatigue_score_pct: number | null
          format: Database["orbit"]["Enums"]["content_format"] | null
          frequency_current: number | null
          id: string
          ig_post_id: string | null
          meta_creative_id: string
          name: string
          status: Database["orbit"]["Enums"]["asset_status"]
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          adset_id: string
          client_id: string
          created_at?: string
          creative_health?: string | null
          ctr_pct_current?: number | null
          ctr_pct_week1?: number | null
          fatigue_cause?: string | null
          fatigue_score_pct?: number | null
          format?: Database["orbit"]["Enums"]["content_format"] | null
          frequency_current?: number | null
          id?: string
          ig_post_id?: string | null
          meta_creative_id: string
          name: string
          status?: Database["orbit"]["Enums"]["asset_status"]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          adset_id?: string
          client_id?: string
          created_at?: string
          creative_health?: string | null
          ctr_pct_current?: number | null
          ctr_pct_week1?: number | null
          fatigue_cause?: string | null
          fatigue_score_pct?: number | null
          format?: Database["orbit"]["Enums"]["content_format"] | null
          frequency_current?: number | null
          id?: string
          ig_post_id?: string | null
          meta_creative_id?: string
          name?: string
          status?: Database["orbit"]["Enums"]["asset_status"]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_meta_creatives_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "ads_meta_adsets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_ig_post_id_fkey"
            columns: ["ig_post_id"]
            isOneToOne: false
            referencedRelation: "ig_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_ig_post_id_fkey"
            columns: ["ig_post_id"]
            isOneToOne: false
            referencedRelation: "v_boost_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_meta_snapshots: {
        Row: {
          adset_id: string | null
          budget_allocated: number | null
          budget_pct_used: number | null
          campaign_id: string | null
          clicks: number | null
          client_id: string
          confidence_level: Database["orbit"]["Enums"]["confidence_level"]
          cost_per_result: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          creative_id: string | null
          ctr_pct: number | null
          frequency: number | null
          id: string
          impressions: number | null
          link_clicks: number | null
          reach: number | null
          result_type: string | null
          results: number | null
          revenue: number | null
          roas: number | null
          snapshot_date: string
          spend: number | null
        }
        Insert: {
          adset_id?: string | null
          budget_allocated?: number | null
          budget_pct_used?: number | null
          campaign_id?: string | null
          clicks?: number | null
          client_id: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          creative_id?: string | null
          ctr_pct?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          link_clicks?: number | null
          reach?: number | null
          result_type?: string | null
          results?: number | null
          revenue?: number | null
          roas?: number | null
          snapshot_date: string
          spend?: number | null
        }
        Update: {
          adset_id?: string | null
          budget_allocated?: number | null
          budget_pct_used?: number | null
          campaign_id?: string | null
          clicks?: number | null
          client_id?: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          creative_id?: string | null
          ctr_pct?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          link_clicks?: number | null
          reach?: number | null
          result_type?: string | null
          results?: number | null
          revenue?: number | null
          roas?: number | null
          snapshot_date?: string
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_meta_snapshots_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "ads_meta_adsets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ads_meta_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "v_creative_fatigue"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          action_url: string | null
          alert_type: Database["orbit"]["Enums"]["alert_type"]
          client_id: string
          confidence_level:
            | Database["orbit"]["Enums"]["confidence_level"]
            | null
          created_at: string
          data_source: string | null
          description: string | null
          google_campaign_id: string | null
          id: string
          ig_post_id: string | null
          is_resolved: boolean
          is_snoozed: boolean
          meta_campaign_id: string | null
          meta_creative_id: string | null
          metric_name: string | null
          metric_value: number | null
          natureza: Database["orbit"]["Enums"]["alert_natureza"] | null
          probable_cause: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["orbit"]["Enums"]["alert_severity"]
          snapshot_id: string | null
          snoozed_until: string | null
          suggested_action: string | null
          threshold_value: number | null
          title: string
        }
        Insert: {
          action_url?: string | null
          alert_type: Database["orbit"]["Enums"]["alert_type"]
          client_id: string
          confidence_level?:
            | Database["orbit"]["Enums"]["confidence_level"]
            | null
          created_at?: string
          data_source?: string | null
          description?: string | null
          google_campaign_id?: string | null
          id?: string
          ig_post_id?: string | null
          is_resolved?: boolean
          is_snoozed?: boolean
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          metric_name?: string | null
          metric_value?: number | null
          natureza?: Database["orbit"]["Enums"]["alert_natureza"] | null
          probable_cause?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: Database["orbit"]["Enums"]["alert_severity"]
          snapshot_id?: string | null
          snoozed_until?: string | null
          suggested_action?: string | null
          threshold_value?: number | null
          title: string
        }
        Update: {
          action_url?: string | null
          alert_type?: Database["orbit"]["Enums"]["alert_type"]
          client_id?: string
          confidence_level?:
            | Database["orbit"]["Enums"]["confidence_level"]
            | null
          created_at?: string
          data_source?: string | null
          description?: string | null
          google_campaign_id?: string | null
          id?: string
          ig_post_id?: string | null
          is_resolved?: boolean
          is_snoozed?: boolean
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          metric_name?: string | null
          metric_value?: number | null
          natureza?: Database["orbit"]["Enums"]["alert_natureza"] | null
          probable_cause?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["orbit"]["Enums"]["alert_severity"]
          snapshot_id?: string | null
          snoozed_until?: string | null
          suggested_action?: string | null
          threshold_value?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_google_campaign_id_fkey"
            columns: ["google_campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_google_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_ig_post_id_fkey"
            columns: ["ig_post_id"]
            isOneToOne: false
            referencedRelation: "ig_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_ig_post_id_fkey"
            columns: ["ig_post_id"]
            isOneToOne: false
            referencedRelation: "v_boost_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_meta_campaign_id_fkey"
            columns: ["meta_campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_meta_creative_id_fkey"
            columns: ["meta_creative_id"]
            isOneToOne: false
            referencedRelation: "ads_meta_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_meta_creative_id_fkey"
            columns: ["meta_creative_id"]
            isOneToOne: false
            referencedRelation: "v_creative_fatigue"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_alignment_snapshot: {
        Row: {
          age_13_17_pct: number | null
          age_18_24_pct: number | null
          age_25_34_pct: number | null
          age_35_44_pct: number | null
          age_45_54_pct: number | null
          age_55_plus_pct: number | null
          client_id: string
          dominant_bucket: string | null
          dominant_bucket_pct: number | null
          evaluated_at: string | null
          expected_age_max: number | null
          expected_age_min: number | null
          id: string
          is_valid: boolean | null
          match_pct: number | null
          snapshot_id: string
        }
        Insert: {
          age_13_17_pct?: number | null
          age_18_24_pct?: number | null
          age_25_34_pct?: number | null
          age_35_44_pct?: number | null
          age_45_54_pct?: number | null
          age_55_plus_pct?: number | null
          client_id: string
          dominant_bucket?: string | null
          dominant_bucket_pct?: number | null
          evaluated_at?: string | null
          expected_age_max?: number | null
          expected_age_min?: number | null
          id?: string
          is_valid?: boolean | null
          match_pct?: number | null
          snapshot_id: string
        }
        Update: {
          age_13_17_pct?: number | null
          age_18_24_pct?: number | null
          age_25_34_pct?: number | null
          age_35_44_pct?: number | null
          age_45_54_pct?: number | null
          age_55_plus_pct?: number | null
          client_id?: string
          dominant_bucket?: string | null
          dominant_bucket_pct?: number | null
          evaluated_at?: string | null
          expected_age_max?: number | null
          expected_age_min?: number | null
          id?: string
          is_valid?: boolean | null
          match_pct?: number | null
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_alignment_snapshot_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_alignment_snapshot_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "avatar_alignment_snapshot_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_alignment_snapshot_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "avatar_alignment_snapshot_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_alignment_snapshot_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "avatar_alignment_snapshot_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_alignment_snapshot_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "ig_audience_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_alignment_snapshot_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "v_audience_alignment"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_validations: {
        Row: {
          client_id: string
          confidence_level: string
          created_at: string | null
          id: string
          notes: string | null
          observed_geo_pct: number | null
          observed_geo_primary: string | null
          observed_interest: string | null
          source: string
          validation_date: string
        }
        Insert: {
          client_id: string
          confidence_level: string
          created_at?: string | null
          id?: string
          notes?: string | null
          observed_geo_pct?: number | null
          observed_geo_primary?: string | null
          observed_interest?: string | null
          source: string
          validation_date?: string
        }
        Update: {
          client_id?: string
          confidence_level?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          observed_geo_pct?: number | null
          observed_geo_primary?: string | null
          observed_interest?: string | null
          source?: string
          validation_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_validations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_validations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "avatar_validations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_validations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "avatar_validations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_validations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "avatar_validations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding: {
        Row: {
          audience_alta_rotatividade_pct: number | null
          audience_consumo_passivo_pct: number | null
          audience_curiosidade_externa_pct: number | null
          audience_nucleo_fiel_pct: number | null
          avatar_expected_age_max: number | null
          avatar_expected_age_min: number | null
          avatar_expected_gender:
            | Database["orbit"]["Enums"]["gender_category"]
            | null
          avatar_expected_gender_pct: number | null
          bio_links: Json
          client_id: string
          confidence_audiencia: string | null
          confidence_bio_funil: string | null
          confidence_diagnostico: string | null
          confidence_negocio: string | null
          confidence_seguidores: string | null
          cta_type: string | null
          funnel_maturity: string | null
          nicho: string | null
          observed_content_clusters: string | null
          proof_mechanism: string | null
          q1_engagement_period_notes: string | null
          q2_content_proxy_notes: string | null
          q3_misalignment_notes: string | null
          setor_benchmark: string | null
          total_followers: number
          total_followers_source: string
          updated_at: string | null
          updated_by: string | null
          values_affect_confidence: string | null
          values_affect_source: string | null
        }
        Insert: {
          audience_alta_rotatividade_pct?: number | null
          audience_consumo_passivo_pct?: number | null
          audience_curiosidade_externa_pct?: number | null
          audience_nucleo_fiel_pct?: number | null
          avatar_expected_age_max?: number | null
          avatar_expected_age_min?: number | null
          avatar_expected_gender?:
            | Database["orbit"]["Enums"]["gender_category"]
            | null
          avatar_expected_gender_pct?: number | null
          bio_links?: Json
          client_id: string
          confidence_audiencia?: string | null
          confidence_bio_funil?: string | null
          confidence_diagnostico?: string | null
          confidence_negocio?: string | null
          confidence_seguidores?: string | null
          cta_type?: string | null
          funnel_maturity?: string | null
          nicho?: string | null
          observed_content_clusters?: string | null
          proof_mechanism?: string | null
          q1_engagement_period_notes?: string | null
          q2_content_proxy_notes?: string | null
          q3_misalignment_notes?: string | null
          setor_benchmark?: string | null
          total_followers: number
          total_followers_source: string
          updated_at?: string | null
          updated_by?: string | null
          values_affect_confidence?: string | null
          values_affect_source?: string | null
        }
        Update: {
          audience_alta_rotatividade_pct?: number | null
          audience_consumo_passivo_pct?: number | null
          audience_curiosidade_externa_pct?: number | null
          audience_nucleo_fiel_pct?: number | null
          avatar_expected_age_max?: number | null
          avatar_expected_age_min?: number | null
          avatar_expected_gender?:
            | Database["orbit"]["Enums"]["gender_category"]
            | null
          avatar_expected_gender_pct?: number | null
          bio_links?: Json
          client_id?: string
          confidence_audiencia?: string | null
          confidence_bio_funil?: string | null
          confidence_diagnostico?: string | null
          confidence_negocio?: string | null
          confidence_seguidores?: string | null
          cta_type?: string | null
          funnel_maturity?: string | null
          nicho?: string | null
          observed_content_clusters?: string | null
          proof_mechanism?: string | null
          q1_engagement_period_notes?: string | null
          q2_content_proxy_notes?: string | null
          q3_misalignment_notes?: string | null
          setor_benchmark?: string | null
          total_followers?: number
          total_followers_source?: string
          updated_at?: string | null
          updated_by?: string | null
          values_affect_confidence?: string | null
          values_affect_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reports: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          exported_at: string | null
          hide_internal_metrics: boolean
          id: string
          manager_note: string | null
          pdf_url: string | null
          period_end: string
          period_start: string
          priorities: Json | null
          title: string
          visible_metrics: Json | null
          wins_narrative: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          exported_at?: string | null
          hide_internal_metrics?: boolean
          id?: string
          manager_note?: string | null
          pdf_url?: string | null
          period_end: string
          period_start: string
          priorities?: Json | null
          title: string
          visible_metrics?: Json | null
          wins_narrative?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          exported_at?: string | null
          hide_internal_metrics?: boolean
          id?: string
          manager_note?: string | null
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          priorities?: Json | null
          title?: string
          visible_metrics?: Json | null
          wins_narrative?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          avatar_alignment_hypothesis: string | null
          avatar_expected_age_max: number | null
          avatar_expected_age_min: number | null
          avatar_expected_gender:
            | Database["orbit"]["Enums"]["gender_category"]
            | null
          avatar_expected_gender_pct: number | null
          avatar_expected_geo_pct: number | null
          avatar_expected_geo_primary: string | null
          avatar_expected_interest: string | null
          avatar_unconscious_desire: string | null
          benchmark_category: string | null
          business_objective: string | null
          created_at: string
          gross_margin_pct: number | null
          handle: string
          health_status: Database["orbit"]["Enums"]["health_status"]
          health_updated_at: string | null
          id: string
          ig_display_name: string | null
          ig_username: string | null
          instagram_user_id: string | null
          is_benchmark: boolean
          monthly_ad_budget: number | null
          name: string
          segment: string | null
          subscription_id: string | null
          threshold_avatar_alignment_min: number | null
          threshold_churn_monthly_max: number | null
          threshold_cpa_max_multiplier: number | null
          threshold_ctr_ads_min: number | null
          threshold_ctr_bio_min: number | null
          threshold_ctr_search_min: number | null
          threshold_er_real_min: number | null
          threshold_fatigue_critical: number | null
          threshold_frequency_max: number | null
          threshold_polemic_max: number | null
          threshold_utility_min: number | null
          updated_at: string
        }
        Insert: {
          avatar_alignment_hypothesis?: string | null
          avatar_expected_age_max?: number | null
          avatar_expected_age_min?: number | null
          avatar_expected_gender?:
            | Database["orbit"]["Enums"]["gender_category"]
            | null
          avatar_expected_gender_pct?: number | null
          avatar_expected_geo_pct?: number | null
          avatar_expected_geo_primary?: string | null
          avatar_expected_interest?: string | null
          avatar_unconscious_desire?: string | null
          benchmark_category?: string | null
          business_objective?: string | null
          created_at?: string
          gross_margin_pct?: number | null
          handle: string
          health_status?: Database["orbit"]["Enums"]["health_status"]
          health_updated_at?: string | null
          id?: string
          ig_display_name?: string | null
          ig_username?: string | null
          instagram_user_id?: string | null
          is_benchmark?: boolean
          monthly_ad_budget?: number | null
          name: string
          segment?: string | null
          subscription_id?: string | null
          threshold_avatar_alignment_min?: number | null
          threshold_churn_monthly_max?: number | null
          threshold_cpa_max_multiplier?: number | null
          threshold_ctr_ads_min?: number | null
          threshold_ctr_bio_min?: number | null
          threshold_ctr_search_min?: number | null
          threshold_er_real_min?: number | null
          threshold_fatigue_critical?: number | null
          threshold_frequency_max?: number | null
          threshold_polemic_max?: number | null
          threshold_utility_min?: number | null
          updated_at?: string
        }
        Update: {
          avatar_alignment_hypothesis?: string | null
          avatar_expected_age_max?: number | null
          avatar_expected_age_min?: number | null
          avatar_expected_gender?:
            | Database["orbit"]["Enums"]["gender_category"]
            | null
          avatar_expected_gender_pct?: number | null
          avatar_expected_geo_pct?: number | null
          avatar_expected_geo_primary?: string | null
          avatar_expected_interest?: string | null
          avatar_unconscious_desire?: string | null
          benchmark_category?: string | null
          business_objective?: string | null
          created_at?: string
          gross_margin_pct?: number | null
          handle?: string
          health_status?: Database["orbit"]["Enums"]["health_status"]
          health_updated_at?: string | null
          id?: string
          ig_display_name?: string | null
          ig_username?: string | null
          instagram_user_id?: string | null
          is_benchmark?: boolean
          monthly_ad_budget?: number | null
          name?: string
          segment?: string | null
          subscription_id?: string | null
          threshold_avatar_alignment_min?: number | null
          threshold_churn_monthly_max?: number | null
          threshold_cpa_max_multiplier?: number | null
          threshold_ctr_ads_min?: number | null
          threshold_ctr_bio_min?: number | null
          threshold_ctr_search_min?: number | null
          threshold_er_real_min?: number | null
          threshold_fatigue_critical?: number | null
          threshold_frequency_max?: number | null
          threshold_polemic_max?: number | null
          threshold_utility_min?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_insights: {
        Row: {
          client_id: string
          confidence_level: Database["orbit"]["Enums"]["confidence_level"]
          created_at: string
          exportable: boolean
          id: string
          metric_name: string | null
          natureza: Database["orbit"]["Enums"]["alert_natureza"]
          snapshot_id: string | null
          text: string
        }
        Insert: {
          client_id: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          created_at?: string
          exportable?: boolean
          id?: string
          metric_name?: string | null
          natureza?: Database["orbit"]["Enums"]["alert_natureza"]
          snapshot_id?: string | null
          text: string
        }
        Update: {
          client_id?: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          created_at?: string
          exportable?: boolean
          id?: string
          metric_name?: string | null
          natureza?: Database["orbit"]["Enums"]["alert_natureza"]
          snapshot_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "content_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "content_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "content_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_data: {
        Row: {
          alcance: number
          client_id: string
          cliques: number | null
          created_at: string
          ctr_bio: number
          id: string
          period_end: string
          period_start: string
          taxa_conv: number
          vendas: number | null
          visitas: number
        }
        Insert: {
          alcance?: number
          client_id: string
          cliques?: number | null
          created_at?: string
          ctr_bio?: number
          id?: string
          period_end: string
          period_start: string
          taxa_conv?: number
          vendas?: number | null
          visitas?: number
        }
        Update: {
          alcance?: number
          client_id?: string
          cliques?: number | null
          created_at?: string
          ctr_bio?: number
          id?: string
          period_end?: string
          period_start?: string
          taxa_conv?: number
          vendas?: number | null
          visitas?: number
        }
        Relationships: [
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_account_snapshots: {
        Row: {
          client_id: string
          created_at: string
          er_real_pct: number | null
          follower_churn_pct: number | null
          followers_confidence: Database["orbit"]["Enums"]["confidence_level"]
          followers_lost: number | null
          followers_net: number | null
          followers_new: number | null
          followers_total: number | null
          id: string
          import_session: string | null
          impressions_confidence: Database["orbit"]["Enums"]["confidence_level"]
          impressions_total: number | null
          interactions_comments: number | null
          interactions_confidence: Database["orbit"]["Enums"]["confidence_level"]
          interactions_likes: number | null
          interactions_saves: number | null
          interactions_shares: number | null
          link_clicks: number | null
          link_ctr_pct: number | null
          period_days: number | null
          period_end: string
          period_source: Database["orbit"]["Enums"]["period_source"]
          period_start: string
          polemic_score_pct: number | null
          profile_visits: number | null
          reach_confidence: Database["orbit"]["Enums"]["confidence_level"]
          reach_followers_pct: number | null
          reach_non_followers: number | null
          reach_total: number | null
          utility_score_pct: number | null
          vps_pct: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          er_real_pct?: number | null
          follower_churn_pct?: number | null
          followers_confidence?: Database["orbit"]["Enums"]["confidence_level"]
          followers_lost?: number | null
          followers_net?: number | null
          followers_new?: number | null
          followers_total?: number | null
          id?: string
          import_session?: string | null
          impressions_confidence?: Database["orbit"]["Enums"]["confidence_level"]
          impressions_total?: number | null
          interactions_comments?: number | null
          interactions_confidence?: Database["orbit"]["Enums"]["confidence_level"]
          interactions_likes?: number | null
          interactions_saves?: number | null
          interactions_shares?: number | null
          link_clicks?: number | null
          link_ctr_pct?: number | null
          period_days?: number | null
          period_end: string
          period_source?: Database["orbit"]["Enums"]["period_source"]
          period_start: string
          polemic_score_pct?: number | null
          profile_visits?: number | null
          reach_confidence?: Database["orbit"]["Enums"]["confidence_level"]
          reach_followers_pct?: number | null
          reach_non_followers?: number | null
          reach_total?: number | null
          utility_score_pct?: number | null
          vps_pct?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          er_real_pct?: number | null
          follower_churn_pct?: number | null
          followers_confidence?: Database["orbit"]["Enums"]["confidence_level"]
          followers_lost?: number | null
          followers_net?: number | null
          followers_new?: number | null
          followers_total?: number | null
          id?: string
          import_session?: string | null
          impressions_confidence?: Database["orbit"]["Enums"]["confidence_level"]
          impressions_total?: number | null
          interactions_comments?: number | null
          interactions_confidence?: Database["orbit"]["Enums"]["confidence_level"]
          interactions_likes?: number | null
          interactions_saves?: number | null
          interactions_shares?: number | null
          link_clicks?: number | null
          link_ctr_pct?: number | null
          period_days?: number | null
          period_end?: string
          period_source?: Database["orbit"]["Enums"]["period_source"]
          period_start?: string
          polemic_score_pct?: number | null
          profile_visits?: number | null
          reach_confidence?: Database["orbit"]["Enums"]["confidence_level"]
          reach_followers_pct?: number | null
          reach_non_followers?: number | null
          reach_total?: number | null
          utility_score_pct?: number | null
          vps_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_import_session_fkey"
            columns: ["import_session"]
            isOneToOne: false
            referencedRelation: "ig_import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_audience_snapshots: {
        Row: {
          age_13_17_pct: number | null
          age_18_24_pct: number | null
          age_25_34_pct: number | null
          age_35_44_pct: number | null
          age_45_54_pct: number | null
          age_55_plus_pct: number | null
          avatar_age_alignment_score: number | null
          avatar_composite_score: number | null
          avatar_gender_alignment_score: number | null
          avatar_geo_alignment_score: number | null
          client_id: string
          confidence_level: Database["orbit"]["Enums"]["confidence_level"]
          created_at: string
          gender_female_pct: number | null
          gender_male_pct: number | null
          gender_other_pct: number | null
          id: string
          import_session: string | null
          period_end: string
          period_start: string
          top_cities: Json | null
          top_countries: Json | null
        }
        Insert: {
          age_13_17_pct?: number | null
          age_18_24_pct?: number | null
          age_25_34_pct?: number | null
          age_35_44_pct?: number | null
          age_45_54_pct?: number | null
          age_55_plus_pct?: number | null
          avatar_age_alignment_score?: number | null
          avatar_composite_score?: number | null
          avatar_gender_alignment_score?: number | null
          avatar_geo_alignment_score?: number | null
          client_id: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          created_at?: string
          gender_female_pct?: number | null
          gender_male_pct?: number | null
          gender_other_pct?: number | null
          id?: string
          import_session?: string | null
          period_end: string
          period_start: string
          top_cities?: Json | null
          top_countries?: Json | null
        }
        Update: {
          age_13_17_pct?: number | null
          age_18_24_pct?: number | null
          age_25_34_pct?: number | null
          age_35_44_pct?: number | null
          age_45_54_pct?: number | null
          age_55_plus_pct?: number | null
          avatar_age_alignment_score?: number | null
          avatar_composite_score?: number | null
          avatar_gender_alignment_score?: number | null
          avatar_geo_alignment_score?: number | null
          client_id?: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          created_at?: string
          gender_female_pct?: number | null
          gender_male_pct?: number | null
          gender_other_pct?: number | null
          id?: string
          import_session?: string | null
          period_end?: string
          period_start?: string
          top_cities?: Json | null
          top_countries?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_import_session_fkey"
            columns: ["import_session"]
            isOneToOne: false
            referencedRelation: "ig_import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_import_sessions: {
        Row: {
          client_id: string | null
          created_at: string
          error_log: string | null
          export_period_end: string | null
          export_period_start: string | null
          export_zip_hash: string | null
          files_missing: string[] | null
          files_processed: string[] | null
          id: string
          period_days: number | null
          processed_at: string | null
          scripts_run: Database["orbit"]["Enums"]["ingest_script"][] | null
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error_log?: string | null
          export_period_end?: string | null
          export_period_start?: string | null
          export_zip_hash?: string | null
          files_missing?: string[] | null
          files_processed?: string[] | null
          id?: string
          period_days?: number | null
          processed_at?: string | null
          scripts_run?: Database["orbit"]["Enums"]["ingest_script"][] | null
          status?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error_log?: string | null
          export_period_end?: string | null
          export_period_start?: string | null
          export_zip_hash?: string | null
          files_missing?: string[] | null
          files_processed?: string[] | null
          id?: string
          period_days?: number | null
          processed_at?: string | null
          scripts_run?: Database["orbit"]["Enums"]["ingest_script"][] | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_import_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_import_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_import_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_import_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_import_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_import_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_import_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_posts: {
        Row: {
          boost_conditions_met: number
          caption: string | null
          client_id: string
          comments: number | null
          confidence_level: Database["orbit"]["Enums"]["confidence_level"]
          content_format: Database["orbit"]["Enums"]["content_format"]
          created_at: string
          er_real_pct: number | null
          follows_from: number | null
          id: string
          ig_post_uri: string
          ig_shortcode: string | null
          import_session: string | null
          impressions: number | null
          is_boost_candidate: boolean
          is_estimated: boolean
          likes: number | null
          polemic_score_pct: number | null
          profile_visits_from: number | null
          published_at: string
          reach: number | null
          reel_avg_watch_sec: number | null
          reel_duration_sec: number | null
          reel_plays: number | null
          saves: number | null
          shares: number | null
          utility_score_pct: number | null
        }
        Insert: {
          boost_conditions_met?: number
          caption?: string | null
          client_id: string
          comments?: number | null
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          content_format: Database["orbit"]["Enums"]["content_format"]
          created_at?: string
          er_real_pct?: number | null
          follows_from?: number | null
          id?: string
          ig_post_uri: string
          ig_shortcode?: string | null
          import_session?: string | null
          impressions?: number | null
          is_boost_candidate?: boolean
          is_estimated?: boolean
          likes?: number | null
          polemic_score_pct?: number | null
          profile_visits_from?: number | null
          published_at: string
          reach?: number | null
          reel_avg_watch_sec?: number | null
          reel_duration_sec?: number | null
          reel_plays?: number | null
          saves?: number | null
          shares?: number | null
          utility_score_pct?: number | null
        }
        Update: {
          boost_conditions_met?: number
          caption?: string | null
          client_id?: string
          comments?: number | null
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          content_format?: Database["orbit"]["Enums"]["content_format"]
          created_at?: string
          er_real_pct?: number | null
          follows_from?: number | null
          id?: string
          ig_post_uri?: string
          ig_shortcode?: string | null
          import_session?: string | null
          impressions?: number | null
          is_boost_candidate?: boolean
          is_estimated?: boolean
          likes?: number | null
          polemic_score_pct?: number | null
          profile_visits_from?: number | null
          published_at?: string
          reach?: number | null
          reel_avg_watch_sec?: number | null
          reel_duration_sec?: number | null
          reel_plays?: number | null
          saves?: number | null
          shares?: number | null
          utility_score_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_import_session_fkey"
            columns: ["import_session"]
            isOneToOne: false
            referencedRelation: "ig_import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_history: {
        Row: {
          client_id: string
          confidence_level: Database["orbit"]["Enums"]["confidence_level"]
          id: string
          metric_date: string
          metric_name: string
          metric_value: number
          platform: string
          recorded_at: string
          source_snapshot_id: string | null
        }
        Insert: {
          client_id: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          id?: string
          metric_date: string
          metric_name: string
          metric_value: number
          platform: string
          recorded_at?: string
          source_snapshot_id?: string | null
        }
        Update: {
          client_id?: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          id?: string
          metric_date?: string
          metric_name?: string
          metric_value?: number
          platform?: string
          recorded_at?: string
          source_snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metric_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "metric_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "metric_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "metric_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_ig_ingest: {
        Row: {
          client_id: string
          confidence_level: Database["orbit"]["Enums"]["confidence_level"]
          id: string
          import_session: string
          ingest_script: Database["orbit"]["Enums"]["ingest_script"]
          ingested_at: string
          parse_error: string | null
          parsed: boolean
          parsed_into: string | null
          raw_payload: Json
          source_file: string
          source_key: string
        }
        Insert: {
          client_id: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          id?: string
          import_session: string
          ingest_script: Database["orbit"]["Enums"]["ingest_script"]
          ingested_at?: string
          parse_error?: string | null
          parsed?: boolean
          parsed_into?: string | null
          raw_payload: Json
          source_file: string
          source_key: string
        }
        Update: {
          client_id?: string
          confidence_level?: Database["orbit"]["Enums"]["confidence_level"]
          id?: string
          import_session?: string
          ingest_script?: Database["orbit"]["Enums"]["ingest_script"]
          ingested_at?: string
          parse_error?: string | null
          parsed?: boolean
          parsed_into?: string | null
          raw_payload?: Json
          source_file?: string
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_ig_ingest_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_ig_ingest_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "raw_ig_ingest_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_ig_ingest_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "raw_ig_ingest_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_ig_ingest_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "raw_ig_ingest_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_ig_ingest_import_session_fkey"
            columns: ["import_session"]
            isOneToOne: false
            referencedRelation: "ig_import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_export_file_catalog: {
        Row: {
          confidence_level:
            | Database["orbit"]["Enums"]["confidence_level"]
            | null
          destination_table: string | null
          filename: string
          id: number
          ingest_script: Database["orbit"]["Enums"]["ingest_script"] | null
          mrr_refs: string[] | null
          notes: string | null
          root_key: string | null
          status: string
        }
        Insert: {
          confidence_level?:
            | Database["orbit"]["Enums"]["confidence_level"]
            | null
          destination_table?: string | null
          filename: string
          id?: number
          ingest_script?: Database["orbit"]["Enums"]["ingest_script"] | null
          mrr_refs?: string[] | null
          notes?: string | null
          root_key?: string | null
          status: string
        }
        Update: {
          confidence_level?:
            | Database["orbit"]["Enums"]["confidence_level"]
            | null
          destination_table?: string | null
          filename?: string
          id?: number
          ingest_script?: Database["orbit"]["Enums"]["ingest_script"] | null
          mrr_refs?: string[] | null
          notes?: string | null
          root_key?: string | null
          status?: string
        }
        Relationships: []
      }
      ref_thresholds: {
        Row: {
          amber_max: number | null
          amber_min: number | null
          benchmark_note: string | null
          calibration_method:
            | Database["orbit"]["Enums"]["calibration_method"]
            | null
          category: string | null
          confidence_score: number | null
          dataset_id: string | null
          direction: string | null
          formula: string | null
          green_max: number | null
          green_min: number | null
          id: number
          metric_name: string
          mrr_ref: string | null
          notes: string | null
          observation_unit: string | null
          percentile_p10: number | null
          percentile_p25: number | null
          percentile_p50: number | null
          percentile_p75: number | null
          percentile_p90: number | null
          red_max: number | null
          red_min: number | null
          sample_count: number | null
          sample_mean: number | null
          sample_std: number | null
          threshold_source: string | null
          tier_normalized: string | null
          unit: string | null
          zero_count: number | null
          zero_rate: number | null
        }
        Insert: {
          amber_max?: number | null
          amber_min?: number | null
          benchmark_note?: string | null
          calibration_method?:
            | Database["orbit"]["Enums"]["calibration_method"]
            | null
          category?: string | null
          confidence_score?: number | null
          dataset_id?: string | null
          direction?: string | null
          formula?: string | null
          green_max?: number | null
          green_min?: number | null
          id?: number
          metric_name: string
          mrr_ref?: string | null
          notes?: string | null
          observation_unit?: string | null
          percentile_p10?: number | null
          percentile_p25?: number | null
          percentile_p50?: number | null
          percentile_p75?: number | null
          percentile_p90?: number | null
          red_max?: number | null
          red_min?: number | null
          sample_count?: number | null
          sample_mean?: number | null
          sample_std?: number | null
          threshold_source?: string | null
          tier_normalized?: string | null
          unit?: string | null
          zero_count?: number | null
          zero_rate?: number | null
        }
        Update: {
          amber_max?: number | null
          amber_min?: number | null
          benchmark_note?: string | null
          calibration_method?:
            | Database["orbit"]["Enums"]["calibration_method"]
            | null
          category?: string | null
          confidence_score?: number | null
          dataset_id?: string | null
          direction?: string | null
          formula?: string | null
          green_max?: number | null
          green_min?: number | null
          id?: number
          metric_name?: string
          mrr_ref?: string | null
          notes?: string | null
          observation_unit?: string | null
          percentile_p10?: number | null
          percentile_p25?: number | null
          percentile_p50?: number | null
          percentile_p75?: number | null
          percentile_p90?: number | null
          red_max?: number | null
          red_min?: number | null
          sample_count?: number | null
          sample_mean?: number | null
          sample_std?: number | null
          threshold_source?: string | null
          tier_normalized?: string | null
          unit?: string | null
          zero_count?: number | null
          zero_rate?: number | null
        }
        Relationships: []
      }
      ref_thresholds_backup_20260918: {
        Row: {
          amber_max: number | null
          amber_min: number | null
          benchmark_note: string | null
          calibration_method:
            | Database["orbit"]["Enums"]["calibration_method"]
            | null
          category: string | null
          confidence_score: number | null
          dataset_id: string | null
          direction: string | null
          formula: string | null
          green_max: number | null
          green_min: number | null
          id: number | null
          metric_name: string | null
          mrr_ref: string | null
          notes: string | null
          observation_unit: string | null
          percentile_p10: number | null
          percentile_p25: number | null
          percentile_p50: number | null
          percentile_p75: number | null
          percentile_p90: number | null
          red_max: number | null
          red_min: number | null
          sample_count: number | null
          sample_mean: number | null
          sample_std: number | null
          threshold_source: string | null
          tier_normalized: string | null
          unit: string | null
          zero_count: number | null
          zero_rate: number | null
        }
        Insert: {
          amber_max?: number | null
          amber_min?: number | null
          benchmark_note?: string | null
          calibration_method?:
            | Database["orbit"]["Enums"]["calibration_method"]
            | null
          category?: string | null
          confidence_score?: number | null
          dataset_id?: string | null
          direction?: string | null
          formula?: string | null
          green_max?: number | null
          green_min?: number | null
          id?: number | null
          metric_name?: string | null
          mrr_ref?: string | null
          notes?: string | null
          observation_unit?: string | null
          percentile_p10?: number | null
          percentile_p25?: number | null
          percentile_p50?: number | null
          percentile_p75?: number | null
          percentile_p90?: number | null
          red_max?: number | null
          red_min?: number | null
          sample_count?: number | null
          sample_mean?: number | null
          sample_std?: number | null
          threshold_source?: string | null
          tier_normalized?: string | null
          unit?: string | null
          zero_count?: number | null
          zero_rate?: number | null
        }
        Update: {
          amber_max?: number | null
          amber_min?: number | null
          benchmark_note?: string | null
          calibration_method?:
            | Database["orbit"]["Enums"]["calibration_method"]
            | null
          category?: string | null
          confidence_score?: number | null
          dataset_id?: string | null
          direction?: string | null
          formula?: string | null
          green_max?: number | null
          green_min?: number | null
          id?: number | null
          metric_name?: string | null
          mrr_ref?: string | null
          notes?: string | null
          observation_unit?: string | null
          percentile_p10?: number | null
          percentile_p25?: number | null
          percentile_p50?: number | null
          percentile_p75?: number | null
          percentile_p90?: number | null
          red_max?: number | null
          red_min?: number | null
          sample_count?: number | null
          sample_mean?: number | null
          sample_std?: number | null
          threshold_source?: string | null
          tier_normalized?: string | null
          unit?: string | null
          zero_count?: number | null
          zero_rate?: number | null
        }
        Relationships: []
      }
      ref_thresholds_v1_backup_20260914: {
        Row: {
          amber_max: number | null
          amber_min: number | null
          benchmark_note: string | null
          calibration_method:
            | Database["orbit"]["Enums"]["calibration_method"]
            | null
          category: string | null
          confidence_score: number | null
          dataset_id: string | null
          direction: string | null
          formula: string | null
          green_max: number | null
          green_min: number | null
          id: number | null
          metric_name: string | null
          mrr_ref: string | null
          notes: string | null
          observation_unit: string | null
          percentile_p10: number | null
          percentile_p25: number | null
          percentile_p50: number | null
          percentile_p75: number | null
          percentile_p90: number | null
          red_max: number | null
          red_min: number | null
          sample_count: number | null
          sample_mean: number | null
          sample_std: number | null
          threshold_source: string | null
          tier_normalized: string | null
          unit: string | null
          zero_count: number | null
          zero_rate: number | null
        }
        Insert: {
          amber_max?: number | null
          amber_min?: number | null
          benchmark_note?: string | null
          calibration_method?:
            | Database["orbit"]["Enums"]["calibration_method"]
            | null
          category?: string | null
          confidence_score?: number | null
          dataset_id?: string | null
          direction?: string | null
          formula?: string | null
          green_max?: number | null
          green_min?: number | null
          id?: number | null
          metric_name?: string | null
          mrr_ref?: string | null
          notes?: string | null
          observation_unit?: string | null
          percentile_p10?: number | null
          percentile_p25?: number | null
          percentile_p50?: number | null
          percentile_p75?: number | null
          percentile_p90?: number | null
          red_max?: number | null
          red_min?: number | null
          sample_count?: number | null
          sample_mean?: number | null
          sample_std?: number | null
          threshold_source?: string | null
          tier_normalized?: string | null
          unit?: string | null
          zero_count?: number | null
          zero_rate?: number | null
        }
        Update: {
          amber_max?: number | null
          amber_min?: number | null
          benchmark_note?: string | null
          calibration_method?:
            | Database["orbit"]["Enums"]["calibration_method"]
            | null
          category?: string | null
          confidence_score?: number | null
          dataset_id?: string | null
          direction?: string | null
          formula?: string | null
          green_max?: number | null
          green_min?: number | null
          id?: number | null
          metric_name?: string | null
          mrr_ref?: string | null
          notes?: string | null
          observation_unit?: string | null
          percentile_p10?: number | null
          percentile_p25?: number | null
          percentile_p50?: number | null
          percentile_p75?: number | null
          percentile_p90?: number | null
          red_max?: number | null
          red_min?: number | null
          sample_count?: number | null
          sample_mean?: number | null
          sample_std?: number | null
          threshold_source?: string | null
          tier_normalized?: string | null
          unit?: string | null
          zero_count?: number | null
          zero_rate?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string | null
          id: string
          max_clients: number
          name: string
          plan: string
          price_monthly: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_clients: number
          name: string
          plan: string
          price_monthly: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_clients?: number
          name?: string
          plan?: string
          price_monthly?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          is_super_admin: boolean | null
          subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_super_admin?: boolean | null
          subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_super_admin?: boolean | null
          subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_alerts: {
        Row: {
          actionUrl: string | null
          alertType: string | null
          clientHandle: string | null
          clientId: string | null
          clientName: string | null
          confidenceLevel: string | null
          createdAt: string | null
          dataSource: string | null
          description: string | null
          id: string | null
          is_resolved: boolean | null
          is_snoozed: boolean | null
          metricName: string | null
          metricValue: number | null
          natureza: string | null
          probableCause: string | null
          resolvedAt: string | null
          resolvedBy: string | null
          severity: string | null
          snapshotId: string | null
          snoozedUntil: string | null
          suggestedAction: string | null
          thresholdValue: number | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_algo_risk_score: {
        Row: {
          algo_risk_score: number | null
          client_id: string | null
          confidence: string | null
          median_b: number | null
          median_r: number | null
          n_b: number | null
          n_r: number | null
          note: string | null
          threshold_source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_audience_alignment: {
        Row: {
          avatar_alignment_status:
            | Database["orbit"]["Enums"]["health_status"]
            | null
          avatar_composite_score: number | null
          client_id: string | null
          id: string | null
          period_end: string | null
          period_start: string | null
        }
        Insert: {
          avatar_alignment_status?: never
          avatar_composite_score?: number | null
          client_id?: string | null
          id?: string | null
          period_end?: string | null
          period_start?: string | null
        }
        Update: {
          avatar_alignment_status?: never
          avatar_composite_score?: number | null
          client_id?: string | null
          id?: string | null
          period_end?: string | null
          period_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_avatar_alignment: {
        Row: {
          alignment_score: number | null
          alignment_status: Database["orbit"]["Enums"]["health_status"] | null
          client_id: string | null
          expected_age_range: string | null
          expected_gender_female: number | null
          expected_gender_male: number | null
          expected_geo: string | null
          expected_geo_pct: number | null
          expected_interest: string | null
          handle: string | null
          id: string | null
          name: string | null
          real_age_range: string | null
          real_gender_female: number | null
          real_gender_male: number | null
          real_geo: string | null
          real_geo_pct: number | null
          real_interest: string | null
        }
        Relationships: []
      }
      v_avatar_alignment_latest: {
        Row: {
          age_13_17_pct: number | null
          age_18_24_pct: number | null
          age_25_34_pct: number | null
          age_35_44_pct: number | null
          age_45_54_pct: number | null
          age_55_plus_pct: number | null
          avatar_expected_age_max: number | null
          avatar_expected_age_min: number | null
          client_id: string | null
          dominant_bucket: string | null
          dominant_bucket_pct: number | null
          evaluated_at: string | null
          is_valid: boolean | null
          match_pct: number | null
          recommendation: string | null
          snapshot_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avatar_alignment_snapshot_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "ig_audience_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_alignment_snapshot_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "v_audience_alignment"
            referencedColumns: ["id"]
          },
        ]
      }
      v_benchmark_thresholds: {
        Row: {
          categoria: string | null
          media_snapshots: number | null
          total_contas: number | null
        }
        Relationships: []
      }
      v_boost_candidates: {
        Row: {
          boost_conditions_met: number | null
          client_id: string | null
          client_name: string | null
          content_format: Database["orbit"]["Enums"]["content_format"] | null
          followers_total: number | null
          id: string | null
          ig_post_uri: string | null
          published_at: string | null
          reach: number | null
          saves: number | null
          shares: number | null
          shares_pct_of_base: number | null
          utility_score_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_carteira_clients: {
        Row: {
          avatar_alignment_hypothesis: string | null
          avatar_expected_age_max: number | null
          avatar_expected_age_min: number | null
          avatar_expected_gender:
            | Database["orbit"]["Enums"]["gender_category"]
            | null
          avatar_expected_gender_pct: number | null
          avatar_expected_geo_pct: number | null
          avatar_expected_geo_primary: string | null
          avatar_expected_interest: string | null
          avatar_unconscious_desire: string | null
          benchmark_category: string | null
          business_objective: string | null
          created_at: string | null
          gross_margin_pct: number | null
          handle: string | null
          health_status: Database["orbit"]["Enums"]["health_status"] | null
          health_updated_at: string | null
          id: string | null
          ig_display_name: string | null
          ig_username: string | null
          instagram_user_id: string | null
          is_benchmark: boolean | null
          last_snapshot_date: string | null
          monthly_ad_budget: number | null
          name: string | null
          segment: string | null
          snapshot_count: number | null
          subscription_id: string | null
          threshold_avatar_alignment_min: number | null
          threshold_churn_monthly_max: number | null
          threshold_cpa_max_multiplier: number | null
          threshold_ctr_ads_min: number | null
          threshold_ctr_bio_min: number | null
          threshold_ctr_search_min: number | null
          threshold_er_real_min: number | null
          threshold_fatigue_critical: number | null
          threshold_frequency_max: number | null
          threshold_polemic_max: number | null
          threshold_utility_min: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_client_health: {
        Row: {
          avatar_name: string | null
          avg_quality_score: number | null
          client_id: string | null
          days_since_update: number | null
          handle: string | null
          health_status: string | null
          last_updated: string | null
          metric_count: number | null
        }
        Relationships: []
      }
      v_client_metrics: {
        Row: {
          ctr_link: number | null
          engagement_real: number | null
          follower_balance: number | null
          follower_churn_pct: number | null
          followers_total: number | null
          gross_margin_pct: number | null
          handle: string | null
          health_status: Database["orbit"]["Enums"]["health_status"] | null
          id: string | null
          monthly_ad_budget: number | null
          name: string | null
          period_end: string | null
          period_start: string | null
          polemic_score_pct: number | null
          segment: string | null
          utility_score_pct: number | null
          vps_pct: number | null
        }
        Relationships: []
      }
      v_creative_fatigue: {
        Row: {
          adset_name: string | null
          campaign_name: string | null
          client_id: string | null
          client_name: string | null
          creative_health: string | null
          creative_name: string | null
          ctr_pct_current: number | null
          ctr_pct_week1: number | null
          fatigue_cause: string | null
          fatigue_score_pct: number | null
          format: Database["orbit"]["Enums"]["content_format"] | null
          frequency_current: number | null
          id: string | null
          objective: Database["orbit"]["Enums"]["campaign_objective"] | null
          status: Database["orbit"]["Enums"]["asset_status"] | null
          threshold_fatigue_critical: number | null
          threshold_frequency_max: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_format_performance: {
        Row: {
          client_id: string | null
          format_name: string | null
          id: string | null
          period_end: string | null
          period_start: string | null
          post_count: number | null
          save_count: number | null
          share_count: number | null
          trend_color: string | null
          trend_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_funnel_data: {
        Row: {
          clicks: number | null
          client_id: string | null
          conversion_rate_pct: number | null
          created_at: string | null
          ctr_bio_pct: number | null
          id: string | null
          period_end: string | null
          period_start: string | null
          reach: number | null
          sales: number | null
          visits: number | null
        }
        Insert: {
          clicks?: number | null
          client_id?: string | null
          conversion_rate_pct?: number | null
          created_at?: string | null
          ctr_bio_pct?: number | null
          id?: string | null
          period_end?: string | null
          period_start?: string | null
          reach?: number | null
          sales?: number | null
          visits?: number | null
        }
        Update: {
          clicks?: number | null
          client_id?: string | null
          conversion_rate_pct?: number | null
          created_at?: string | null
          ctr_bio_pct?: number | null
          id?: string | null
          period_end?: string | null
          period_start?: string | null
          reach?: number | null
          sales?: number | null
          visits?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "funnel_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_kpi_snapshots: {
        Row: {
          calculated_at: string | null
          client_id: string | null
          confidence_level:
            | Database["orbit"]["Enums"]["confidence_level"]
            | null
          id: string | null
          metric: string | null
          metric_date: string | null
          metric_key: string | null
          metric_name: string | null
          metric_value: number | null
          period_end: string | null
          period_start: string | null
          platform: string | null
          recorded_at: string | null
          source_snapshot_id: string | null
          value: number | null
        }
        Relationships: []
      }
      v_meta_ads_metrics: {
        Row: {
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          client_id: string | null
          confidence_level:
            | Database["orbit"]["Enums"]["confidence_level"]
            | null
          cpc: number | null
          cpl: number | null
          cpm: number | null
          creative_health: string | null
          creative_id: string | null
          ctr: number | null
          fatigue_cause: string | null
          fatigue_percent: number | null
          frequency: number | null
          id: string | null
          impressions: number | null
          objective: Database["orbit"]["Enums"]["campaign_objective"] | null
          reach: number | null
          results: number | null
          revenue: number | null
          roas: number | null
          snapshot_date: string | null
          spend: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_meta_snapshots_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "ads_meta_adsets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ads_meta_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "v_creative_fatigue"
            referencedColumns: ["id"]
          },
        ]
      }
      v_quality_scores: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string | null
          metric_name: string | null
          period_end: string | null
          period_start: string | null
          ref_category: string | null
          ref_direction: string | null
          ref_green_max: number | null
          ref_green_min: number | null
          ref_p50: number | null
          ref_p75: number | null
          ref_red_max: number | null
          ref_red_min: number | null
          ref_source: string | null
          score_key: string | null
          score_value: number | null
          semaphore_key: string | null
          status_text: string | null
          status_variant: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ig_account_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_roas_viability: {
        Row: {
          campaign_name: string | null
          client_id: string | null
          client_name: string | null
          gross_margin_pct: number | null
          objective: Database["orbit"]["Enums"]["campaign_objective"] | null
          roas: number | null
          roas_health: Database["orbit"]["Enums"]["health_status"] | null
          roas_minimum_viable: number | null
          snapshot_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_avatar_alignment_latest"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_carteira_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_meta_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calc_utility_score_pct: { Args: { caption: string }; Returns: number }
      compute_avatar_alignment: {
        Args: { p_audience_id: string; p_client_id: string }
        Returns: {
          age_score: number
          composite: number
          gender_score: number
          geo_score: number
        }[]
      }
      fn_classify_metric: {
        Args: {
          p_category?: string
          p_metric_name: string
          p_tier?: string
          p_value: number
        }
        Returns: {
          calibration_method: Database["orbit"]["Enums"]["calibration_method"]
          category: string
          confidence_level: string
          confidence_score: number
          semaphore: string
          signal_range_label: string
          status_text: string
          tier: string
          zero_pct: number
        }[]
      }
      get_schema_info: {
        Args: never
        Returns: {
          column_default: string
          column_name: string
          data_type: string
          is_nullable: string
          table_name: string
        }[]
      }
      metric_has_negative_slope: {
        Args: {
          p_client_id: string
          p_days?: number
          p_metric_name: string
          p_platform: string
        }
        Returns: boolean
      }
      user_owns_client: { Args: { p_client_id: string }; Returns: boolean }
    }
    Enums: {
      ads_platform: "meta" | "google" | "tiktok" | "linkedin"
      alert_natureza: "tecnica" | "comunicacao"
      alert_severity: "critical" | "warning" | "info" | "success"
      alert_type:
        | "ctr_below_threshold"
        | "engagement_collapse"
        | "avatar_misalignment"
        | "creative_fatigue"
        | "roas_below_minimum"
        | "follower_churn_high"
        | "polemic_score_high"
        | "boost_opportunity"
        | "budget_pace"
      asset_status: "active" | "paused" | "archived" | "draft" | "under_review"
      calibration_method:
        | "percentile_relative"
        | "percentile_based"
        | "percentile_based_lower_better"
        | "empirical_percentile"
        | "empirical_percentile_zero_inflated"
      campaign_objective:
        | "awareness"
        | "reach"
        | "traffic"
        | "engagement"
        | "leads"
        | "app_promotion"
        | "sales"
        | "video_views"
      confidence_level: "L0" | "L1" | "L2"
      content_format:
        | "reel"
        | "static_post"
        | "carousel"
        | "story"
        | "live"
        | "igtv"
      fatigue_cause:
        | "creative_saturation"
        | "segmentation_issue"
        | "offer_issue"
        | "healthy"
      gender_category: "male" | "female" | "non_binary" | "mixed"
      health_status: "healthy" | "warning" | "critical" | "unknown"
      ingest_script:
        | "ingest-l0-v2"
        | "ingest-insights"
        | "extract-demographics"
        | "manual"
        | "ingest-from-zip"
      period_source:
        | "instagram_export"
        | "meta_api"
        | "google_ads_api"
        | "ga4_api"
        | "manual_input"
      semaphore_color: "verde" | "ambar" | "vermelho"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  orbit: {
    Enums: {
      ads_platform: ["meta", "google", "tiktok", "linkedin"],
      alert_natureza: ["tecnica", "comunicacao"],
      alert_severity: ["critical", "warning", "info", "success"],
      alert_type: [
        "ctr_below_threshold",
        "engagement_collapse",
        "avatar_misalignment",
        "creative_fatigue",
        "roas_below_minimum",
        "follower_churn_high",
        "polemic_score_high",
        "boost_opportunity",
        "budget_pace",
      ],
      asset_status: ["active", "paused", "archived", "draft", "under_review"],
      calibration_method: [
        "percentile_relative",
        "percentile_based",
        "percentile_based_lower_better",
        "empirical_percentile",
        "empirical_percentile_zero_inflated",
      ],
      campaign_objective: [
        "awareness",
        "reach",
        "traffic",
        "engagement",
        "leads",
        "app_promotion",
        "sales",
        "video_views",
      ],
      confidence_level: ["L0", "L1", "L2"],
      content_format: [
        "reel",
        "static_post",
        "carousel",
        "story",
        "live",
        "igtv",
      ],
      fatigue_cause: [
        "creative_saturation",
        "segmentation_issue",
        "offer_issue",
        "healthy",
      ],
      gender_category: ["male", "female", "non_binary", "mixed"],
      health_status: ["healthy", "warning", "critical", "unknown"],
      ingest_script: [
        "ingest-l0-v2",
        "ingest-insights",
        "extract-demographics",
        "manual",
        "ingest-from-zip",
      ],
      period_source: [
        "instagram_export",
        "meta_api",
        "google_ads_api",
        "ga4_api",
        "manual_input",
      ],
      semaphore_color: ["verde", "ambar", "vermelho"],
    },
  },
} as const
