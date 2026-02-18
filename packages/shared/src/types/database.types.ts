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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_device_assignments: {
        Row: {
          access_device_id: string
          assigned_at: string
          assigned_by: string | null
          community_id: string
          condition_notes: string | null
          created_at: string
          created_by: string | null
          deposit_amount: number | null
          deposit_collected: boolean
          deposit_returned_at: string | null
          guard_id: string | null
          id: string
          is_active: boolean
          provider_personnel_id: string | null
          replacement_fee_charged: boolean | null
          resident_id: string | null
          return_condition: string | null
          returned_at: string | null
          returned_to: string | null
          unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_device_id: string
          assigned_at?: string
          assigned_by?: string | null
          community_id: string
          condition_notes?: string | null
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_collected?: boolean
          deposit_returned_at?: string | null
          guard_id?: string | null
          id?: string
          is_active?: boolean
          provider_personnel_id?: string | null
          replacement_fee_charged?: boolean | null
          resident_id?: string | null
          return_condition?: string | null
          returned_at?: string | null
          returned_to?: string | null
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_device_id?: string
          assigned_at?: string
          assigned_by?: string | null
          community_id?: string
          condition_notes?: string | null
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_collected?: boolean
          deposit_returned_at?: string | null
          guard_id?: string | null
          id?: string
          is_active?: boolean
          provider_personnel_id?: string | null
          replacement_fee_charged?: boolean | null
          resident_id?: string | null
          return_condition?: string | null
          returned_at?: string | null
          returned_to?: string | null
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_device_assignments_access_device_id_fkey"
            columns: ["access_device_id"]
            isOneToOne: false
            referencedRelation: "access_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_device_assignments_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_device_assignments_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_device_assignments_provider_personnel_id_fkey"
            columns: ["provider_personnel_id"]
            isOneToOne: false
            referencedRelation: "provider_personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_device_assignments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_device_assignments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "access_device_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "access_device_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      access_device_events: {
        Row: {
          access_device_id: string
          description: string
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          performed_by: string | null
        }
        Insert: {
          access_device_id: string
          description: string
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          performed_by?: string | null
        }
        Update: {
          access_device_id?: string
          description?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_device_events_access_device_id_fkey"
            columns: ["access_device_id"]
            isOneToOne: false
            referencedRelation: "access_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      access_device_types: {
        Row: {
          access_point_ids: string[] | null
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_amount: number | null
          description: string | null
          device_type: Database["public"]["Enums"]["device_type"]
          id: string
          is_active: boolean
          name: string
          replacement_fee: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_point_ids?: string[] | null
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number | null
          description?: string | null
          device_type: Database["public"]["Enums"]["device_type"]
          id?: string
          is_active?: boolean
          name: string
          replacement_fee?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_point_ids?: string[] | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number | null
          description?: string | null
          device_type?: Database["public"]["Enums"]["device_type"]
          id?: string
          is_active?: boolean
          name?: string
          replacement_fee?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_device_types_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      access_devices: {
        Row: {
          batch_number: string | null
          community_id: string
          created_at: string
          created_by: string | null
          current_assignment_id: string | null
          damage_notes: string | null
          damaged_reported_at: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          device_type_id: string
          id: string
          internal_code: string | null
          lost_reported_at: string | null
          lost_reported_by: string | null
          purchased_at: string | null
          serial_number: string
          status: Database["public"]["Enums"]["device_status"]
          status_changed_at: string
          updated_at: string
          updated_by: string | null
          vendor: string | null
        }
        Insert: {
          batch_number?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          current_assignment_id?: string | null
          damage_notes?: string | null
          damaged_reported_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          device_type_id: string
          id?: string
          internal_code?: string | null
          lost_reported_at?: string | null
          lost_reported_by?: string | null
          purchased_at?: string | null
          serial_number: string
          status?: Database["public"]["Enums"]["device_status"]
          status_changed_at?: string
          updated_at?: string
          updated_by?: string | null
          vendor?: string | null
        }
        Update: {
          batch_number?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          current_assignment_id?: string | null
          damage_notes?: string | null
          damaged_reported_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          device_type_id?: string
          id?: string
          internal_code?: string | null
          lost_reported_at?: string | null
          lost_reported_by?: string | null
          purchased_at?: string | null
          serial_number?: string
          status?: Database["public"]["Enums"]["device_status"]
          status_changed_at?: string
          updated_at?: string
          updated_by?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_devices_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_devices_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "access_device_inventory"
            referencedColumns: ["device_type_id"]
          },
          {
            foreignKeyName: "access_devices_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "access_device_types"
            referencedColumns: ["id"]
          },
        ]
      }
      access_logs: {
        Row: {
          access_point_id: string
          community_id: string
          decision: Database["public"]["Enums"]["access_decision"]
          denial_reason: string | null
          direction: string
          entry_hash: string | null
          guard_notes: string | null
          id: string
          invitation_id: string | null
          logged_at: string
          method: string
          person_document: string | null
          person_id: string | null
          person_name: string
          person_type: string
          photo_url: string | null
          photo_vehicle_url: string | null
          plate_detected: string | null
          plate_number: string | null
          previous_hash: string | null
          processed_by: string | null
          qr_code_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          access_point_id: string
          community_id: string
          decision: Database["public"]["Enums"]["access_decision"]
          denial_reason?: string | null
          direction: string
          entry_hash?: string | null
          guard_notes?: string | null
          id?: string
          invitation_id?: string | null
          logged_at?: string
          method: string
          person_document?: string | null
          person_id?: string | null
          person_name: string
          person_type: string
          photo_url?: string | null
          photo_vehicle_url?: string | null
          plate_detected?: string | null
          plate_number?: string | null
          previous_hash?: string | null
          processed_by?: string | null
          qr_code_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          access_point_id?: string
          community_id?: string
          decision?: Database["public"]["Enums"]["access_decision"]
          denial_reason?: string | null
          direction?: string
          entry_hash?: string | null
          guard_notes?: string | null
          id?: string
          invitation_id?: string | null
          logged_at?: string
          method?: string
          person_document?: string | null
          person_id?: string | null
          person_name?: string
          person_type?: string
          photo_url?: string | null
          photo_vehicle_url?: string | null
          plate_detected?: string | null
          plate_number?: string | null
          previous_hash?: string | null
          processed_by?: string | null
          qr_code_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_qr_code_fk"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      access_points: {
        Row: {
          access_point_type: Database["public"]["Enums"]["access_point_type"]
          barrier_controller_id: string | null
          camera_device_id: string | null
          can_remote_open: boolean
          code: string | null
          community_id: string
          created_at: string
          deleted_at: string | null
          direction: Database["public"]["Enums"]["access_point_direction"]
          has_camera: boolean
          has_intercom: boolean
          has_lpr: boolean
          has_nfc_reader: boolean
          has_qr_scanner: boolean
          id: string
          is_emergency_exit: boolean
          location_description: string | null
          location_lat: number | null
          location_lng: number | null
          lpr_device_id: string | null
          name: string
          operating_end_time: string | null
          operating_start_time: string | null
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
        }
        Insert: {
          access_point_type: Database["public"]["Enums"]["access_point_type"]
          barrier_controller_id?: string | null
          camera_device_id?: string | null
          can_remote_open?: boolean
          code?: string | null
          community_id: string
          created_at?: string
          deleted_at?: string | null
          direction?: Database["public"]["Enums"]["access_point_direction"]
          has_camera?: boolean
          has_intercom?: boolean
          has_lpr?: boolean
          has_nfc_reader?: boolean
          has_qr_scanner?: boolean
          id?: string
          is_emergency_exit?: boolean
          location_description?: string | null
          location_lat?: number | null
          location_lng?: number | null
          lpr_device_id?: string | null
          name: string
          operating_end_time?: string | null
          operating_start_time?: string | null
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Update: {
          access_point_type?: Database["public"]["Enums"]["access_point_type"]
          barrier_controller_id?: string | null
          camera_device_id?: string | null
          can_remote_open?: boolean
          code?: string | null
          community_id?: string
          created_at?: string
          deleted_at?: string | null
          direction?: Database["public"]["Enums"]["access_point_direction"]
          has_camera?: boolean
          has_intercom?: boolean
          has_lpr?: boolean
          has_nfc_reader?: boolean
          has_qr_scanner?: boolean
          id?: string
          is_emergency_exit?: boolean
          location_description?: string | null
          location_lat?: number | null
          location_lng?: number | null
          lpr_device_id?: string | null
          name?: string
          operating_end_time?: string | null
          operating_start_time?: string | null
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_points_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      accessibility_needs: {
        Row: {
          accommodations: string[] | null
          community_id: string
          created_at: string
          deleted_at: string | null
          description: string
          evacuation_notes: string | null
          has_service_animal: boolean
          id: string
          mobility_device_type:
            | Database["public"]["Enums"]["mobility_device_type"]
            | null
          need_type: Database["public"]["Enums"]["accessibility_need_type"]
          needs_evacuation_assistance: boolean
          resident_id: string
          service_animal_type: string | null
          unit_modifications: string[] | null
          updated_at: string
          uses_mobility_device: boolean
        }
        Insert: {
          accommodations?: string[] | null
          community_id: string
          created_at?: string
          deleted_at?: string | null
          description: string
          evacuation_notes?: string | null
          has_service_animal?: boolean
          id?: string
          mobility_device_type?:
            | Database["public"]["Enums"]["mobility_device_type"]
            | null
          need_type: Database["public"]["Enums"]["accessibility_need_type"]
          needs_evacuation_assistance?: boolean
          resident_id: string
          service_animal_type?: string | null
          unit_modifications?: string[] | null
          updated_at?: string
          uses_mobility_device?: boolean
        }
        Update: {
          accommodations?: string[] | null
          community_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          evacuation_notes?: string | null
          has_service_animal?: boolean
          id?: string
          mobility_device_type?:
            | Database["public"]["Enums"]["mobility_device_type"]
            | null
          need_type?: Database["public"]["Enums"]["accessibility_need_type"]
          needs_evacuation_assistance?: boolean
          resident_id?: string
          service_animal_type?: string | null
          unit_modifications?: string[] | null
          updated_at?: string
          uses_mobility_device?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "accessibility_needs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessibility_needs_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessibility_needs_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_number: string
          balance_as_of: string
          category: Database["public"]["Enums"]["account_category"]
          community_id: string
          created_at: string
          created_by: string | null
          current_balance: number
          deleted_at: string | null
          depth: number
          description: string | null
          id: string
          is_active: boolean
          is_operating_fund: boolean
          is_reserve_fund: boolean
          is_system_account: boolean
          name: string
          normal_balance: string
          parent_account_id: string | null
          subtype: Database["public"]["Enums"]["account_subtype"]
          updated_at: string
        }
        Insert: {
          account_number: string
          balance_as_of?: string
          category: Database["public"]["Enums"]["account_category"]
          community_id: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          deleted_at?: string | null
          depth?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_operating_fund?: boolean
          is_reserve_fund?: boolean
          is_system_account?: boolean
          name: string
          normal_balance: string
          parent_account_id?: string | null
          subtype: Database["public"]["Enums"]["account_subtype"]
          updated_at?: string
        }
        Update: {
          account_number?: string
          balance_as_of?: string
          category?: Database["public"]["Enums"]["account_category"]
          community_id?: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          deleted_at?: string | null
          depth?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_operating_fund?: boolean
          is_reserve_fund?: boolean
          is_system_account?: boolean
          name?: string
          normal_balance?: string
          parent_account_id?: string | null
          subtype?: Database["public"]["Enums"]["account_subtype"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      amenities: {
        Row: {
          amenity_type: Database["public"]["Enums"]["amenity_type"]
          capacity: number | null
          community_id: string
          created_at: string
          created_by: string | null
          default_duration_minutes: number | null
          deleted_at: string | null
          deposit_amount: number | null
          description: string | null
          floor_number: number | null
          hourly_rate: number | null
          id: string
          location: string | null
          maintenance_notes: string | null
          max_advance_days: number | null
          min_advance_hours: number | null
          name: string
          photo_urls: string[] | null
          requires_reservation: boolean
          rules_document_url: string | null
          schedule: Json
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
        }
        Insert: {
          amenity_type: Database["public"]["Enums"]["amenity_type"]
          capacity?: number | null
          community_id: string
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number | null
          deleted_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          floor_number?: number | null
          hourly_rate?: number | null
          id?: string
          location?: string | null
          maintenance_notes?: string | null
          max_advance_days?: number | null
          min_advance_hours?: number | null
          name: string
          photo_urls?: string[] | null
          requires_reservation?: boolean
          rules_document_url?: string | null
          schedule?: Json
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Update: {
          amenity_type?: Database["public"]["Enums"]["amenity_type"]
          capacity?: number | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number | null
          deleted_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          floor_number?: number | null
          hourly_rate?: number | null
          id?: string
          location?: string | null
          maintenance_notes?: string | null
          max_advance_days?: number | null
          min_advance_hours?: number | null
          name?: string
          photo_urls?: string[] | null
          requires_reservation?: boolean
          rules_document_url?: string | null
          schedule?: Json
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenities_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      amenity_rules: {
        Row: {
          amenity_id: string
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string | null
          effective_until: string | null
          id: string
          is_active: boolean
          priority: number
          rule_type: Database["public"]["Enums"]["rule_type"]
          rule_value: Json
          updated_at: string
        }
        Insert: {
          amenity_id: string
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          rule_type: Database["public"]["Enums"]["rule_type"]
          rule_value?: Json
          updated_at?: string
        }
        Update: {
          amenity_id?: string
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          rule_type?: Database["public"]["Enums"]["rule_type"]
          rule_value?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenity_rules_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_rules_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_recipients: {
        Row: {
          acknowledged_at: string | null
          announcement_id: string
          delivered_at: string | null
          delivery_channel: string | null
          id: string
          read_at: string | null
          resident_id: string
          unit_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          announcement_id: string
          delivered_at?: string | null
          delivery_channel?: string | null
          id?: string
          read_at?: string | null
          resident_id: string
          unit_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          announcement_id?: string
          delivered_at?: string | null
          delivery_channel?: string | null
          id?: string
          read_at?: string | null
          resident_id?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "announcement_recipients_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "announcement_recipients_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          acknowledged_count: number
          body: string
          community_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          expires_at: string | null
          id: string
          is_urgent: boolean
          media_urls: string[] | null
          publish_at: string
          read_count: number
          requires_acknowledgment: boolean
          status: Database["public"]["Enums"]["general_status"]
          target_criteria: Json | null
          target_segment: Database["public"]["Enums"]["announcement_segment"]
          title: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          acknowledged_count?: number
          body: string
          community_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          is_urgent?: boolean
          media_urls?: string[] | null
          publish_at?: string
          read_count?: number
          requires_acknowledgment?: boolean
          status?: Database["public"]["Enums"]["general_status"]
          target_criteria?: Json | null
          target_segment?: Database["public"]["Enums"]["announcement_segment"]
          title: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          acknowledged_count?: number
          body?: string
          community_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          is_urgent?: boolean
          media_urls?: string[] | null
          publish_at?: string
          read_count?: number
          requires_acknowledgment?: boolean
          status?: Database["public"]["Enums"]["general_status"]
          target_criteria?: Json | null
          target_segment?: Database["public"]["Enums"]["announcement_segment"]
          title?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      assemblies: {
        Row: {
          agenda_document_id: string | null
          assembly_number: string
          assembly_type: Database["public"]["Enums"]["assembly_type"]
          community_id: string
          convocatoria_1_at: string | null
          convocatoria_2_at: string | null
          convocatoria_3_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          ended_at: string | null
          id: string
          location: string | null
          meeting_url: string | null
          minutes_document_id: string | null
          quorum_coefficient_present: number
          quorum_met: boolean
          quorum_percentage: number
          scheduled_date: string
          scheduled_time: string
          started_at: string | null
          status: Database["public"]["Enums"]["assembly_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agenda_document_id?: string | null
          assembly_number: string
          assembly_type: Database["public"]["Enums"]["assembly_type"]
          community_id: string
          convocatoria_1_at?: string | null
          convocatoria_2_at?: string | null
          convocatoria_3_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          location?: string | null
          meeting_url?: string | null
          minutes_document_id?: string | null
          quorum_coefficient_present?: number
          quorum_met?: boolean
          quorum_percentage?: number
          scheduled_date: string
          scheduled_time: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assembly_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agenda_document_id?: string | null
          assembly_number?: string
          assembly_type?: Database["public"]["Enums"]["assembly_type"]
          community_id?: string
          convocatoria_1_at?: string | null
          convocatoria_2_at?: string | null
          convocatoria_3_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          location?: string | null
          meeting_url?: string | null
          minutes_document_id?: string | null
          quorum_coefficient_present?: number
          quorum_met?: boolean
          quorum_percentage?: number
          scheduled_date?: string
          scheduled_time?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assembly_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assemblies_agenda_document_fk"
            columns: ["agenda_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assemblies_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assemblies_minutes_document_fk"
            columns: ["minutes_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      assembly_agreements: {
        Row: {
          abstentions_coefficient: number | null
          action_completed_at: string | null
          action_description: string | null
          action_due_date: string | null
          action_required: boolean
          action_responsible: string | null
          agreement_number: number
          approved: boolean | null
          assembly_id: string
          created_at: string
          description: string
          display_order: number
          election_id: string | null
          id: string
          title: string
          votes_against_coefficient: number | null
          votes_for_coefficient: number | null
        }
        Insert: {
          abstentions_coefficient?: number | null
          action_completed_at?: string | null
          action_description?: string | null
          action_due_date?: string | null
          action_required?: boolean
          action_responsible?: string | null
          agreement_number: number
          approved?: boolean | null
          assembly_id: string
          created_at?: string
          description: string
          display_order?: number
          election_id?: string | null
          id?: string
          title: string
          votes_against_coefficient?: number | null
          votes_for_coefficient?: number | null
        }
        Update: {
          abstentions_coefficient?: number | null
          action_completed_at?: string | null
          action_description?: string | null
          action_due_date?: string | null
          action_required?: boolean
          action_responsible?: string | null
          agreement_number?: number
          approved?: boolean | null
          assembly_id?: string
          created_at?: string
          description?: string
          display_order?: number
          election_id?: string | null
          id?: string
          title?: string
          votes_against_coefficient?: number | null
          votes_for_coefficient?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assembly_agreements_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_agreements_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      assembly_attendance: {
        Row: {
          arrived_at_convocatoria: number | null
          assembly_id: string
          attendee_name: string | null
          attendee_type: Database["public"]["Enums"]["attendance_type"]
          checked_in_at: string
          checked_out_at: string | null
          coefficient: number
          created_at: string
          id: string
          is_proxy: boolean
          proxy_document_url: string | null
          proxy_grantor_id: string | null
          resident_id: string | null
          unit_id: string
        }
        Insert: {
          arrived_at_convocatoria?: number | null
          assembly_id: string
          attendee_name?: string | null
          attendee_type: Database["public"]["Enums"]["attendance_type"]
          checked_in_at?: string
          checked_out_at?: string | null
          coefficient: number
          created_at?: string
          id?: string
          is_proxy?: boolean
          proxy_document_url?: string | null
          proxy_grantor_id?: string | null
          resident_id?: string | null
          unit_id: string
        }
        Update: {
          arrived_at_convocatoria?: number | null
          assembly_id?: string
          attendee_name?: string | null
          attendee_type?: Database["public"]["Enums"]["attendance_type"]
          checked_in_at?: string
          checked_out_at?: string | null
          coefficient?: number
          created_at?: string
          id?: string
          is_proxy?: boolean
          proxy_document_url?: string | null
          proxy_grantor_id?: string | null
          resident_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assembly_attendance_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_attendance_proxy_grantor_id_fkey"
            columns: ["proxy_grantor_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_attendance_proxy_grantor_id_fkey"
            columns: ["proxy_grantor_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "assembly_attendance_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_attendance_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "assembly_attendance_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "assembly_attendance_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance_history: {
        Row: {
          asset_id: string
          created_at: string
          description: string
          duration_hours: number | null
          id: string
          labor_cost: number | null
          maintenance_type: string
          parts_cost: number | null
          parts_used: Json
          performed_at: string
          performed_by: string | null
          photo_urls: string[] | null
          report_url: string | null
          ticket_id: string | null
          total_cost: number | null
          verified_by: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          description: string
          duration_hours?: number | null
          id?: string
          labor_cost?: number | null
          maintenance_type: string
          parts_cost?: number | null
          parts_used?: Json
          performed_at: string
          performed_by?: string | null
          photo_urls?: string[] | null
          report_url?: string | null
          ticket_id?: string | null
          total_cost?: number | null
          verified_by?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          description?: string
          duration_hours?: number | null
          id?: string
          labor_cost?: number | null
          maintenance_type?: string
          parts_cost?: number | null
          parts_used?: Json
          performed_at?: string
          performed_by?: string | null
          photo_urls?: string[] | null
          report_url?: string | null
          ticket_id?: string | null
          total_cost?: number | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_tag: string | null
          asset_type: string
          building: string | null
          community_id: string
          created_at: string
          created_by: string | null
          current_value: number | null
          deleted_at: string | null
          depreciation_method: string | null
          expected_end_of_life: string | null
          floor: string | null
          id: string
          installed_at: string | null
          last_maintenance_at: string | null
          location: string
          maintenance_interval_days: number | null
          manual_url: string | null
          manufacturer: string | null
          model: string | null
          name: string
          next_maintenance_due: string | null
          photo_urls: string[] | null
          purchase_cost: number | null
          purchased_at: string | null
          serial_number: string | null
          specifications: Json
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
          warranty_expires_at: string | null
        }
        Insert: {
          asset_tag?: string | null
          asset_type: string
          building?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          deleted_at?: string | null
          depreciation_method?: string | null
          expected_end_of_life?: string | null
          floor?: string | null
          id?: string
          installed_at?: string | null
          last_maintenance_at?: string | null
          location: string
          maintenance_interval_days?: number | null
          manual_url?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          next_maintenance_due?: string | null
          photo_urls?: string[] | null
          purchase_cost?: number | null
          purchased_at?: string | null
          serial_number?: string | null
          specifications?: Json
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          warranty_expires_at?: string | null
        }
        Update: {
          asset_tag?: string | null
          asset_type?: string
          building?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          deleted_at?: string | null
          depreciation_method?: string | null
          expected_end_of_life?: string | null
          floor?: string | null
          id?: string
          installed_at?: string | null
          last_maintenance_at?: string | null
          location?: string
          maintenance_interval_days?: number | null
          manual_url?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          next_maintenance_due?: string | null
          photo_urls?: string[] | null
          purchase_cost?: number | null
          purchased_at?: string | null
          serial_number?: string | null
          specifications?: Json
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          warranty_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      ballots: {
        Row: {
          election_id: string
          id: string
          ip_address: unknown
          is_proxy_vote: boolean
          proxy_document_url: string | null
          proxy_for_resident_id: string | null
          selected_options: string[]
          unit_id: string
          user_agent: string | null
          vote_weight: number
          voted_at: string
          voted_by: string
        }
        Insert: {
          election_id: string
          id?: string
          ip_address?: unknown
          is_proxy_vote?: boolean
          proxy_document_url?: string | null
          proxy_for_resident_id?: string | null
          selected_options: string[]
          unit_id: string
          user_agent?: string | null
          vote_weight: number
          voted_at?: string
          voted_by: string
        }
        Update: {
          election_id?: string
          id?: string
          ip_address?: unknown
          is_proxy_vote?: boolean
          proxy_document_url?: string | null
          proxy_for_resident_id?: string | null
          selected_options?: string[]
          unit_id?: string
          user_agent?: string | null
          vote_weight?: number
          voted_at?: string
          voted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ballots_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ballots_proxy_for_resident_id_fkey"
            columns: ["proxy_for_resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ballots_proxy_for_resident_id_fkey"
            columns: ["proxy_for_resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "ballots_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "ballots_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ballots_voted_by_fkey"
            columns: ["voted_by"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ballots_voted_by_fkey"
            columns: ["voted_by"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string
          account_number_hash: string
          account_type: string
          bank_name: string
          clabe: string | null
          clabe_hash: string | null
          community_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          gl_account_id: string
          id: string
          is_active: boolean
          is_primary: boolean
          last_statement_balance: number | null
          last_statement_date: string | null
          updated_at: string
        }
        Insert: {
          account_number: string
          account_number_hash: string
          account_type?: string
          bank_name: string
          clabe?: string | null
          clabe_hash?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          gl_account_id: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_statement_balance?: number | null
          last_statement_date?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string
          account_number_hash?: string
          account_type?: string
          bank_name?: string
          clabe?: string | null
          clabe_hash?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          gl_account_id?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_statement_balance?: number | null
          last_statement_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          amount: number
          community_id: string
          description: string
          id: string
          line_number: number
          match_confidence: number | null
          matched_at: string | null
          matched_by: string | null
          matched_transaction_id: string | null
          notes: string | null
          reference: string | null
          statement_id: string
          status: Database["public"]["Enums"]["statement_line_status"]
          transaction_date: string
          value_date: string | null
        }
        Insert: {
          amount: number
          community_id: string
          description: string
          id?: string
          line_number: number
          match_confidence?: number | null
          matched_at?: string | null
          matched_by?: string | null
          matched_transaction_id?: string | null
          notes?: string | null
          reference?: string | null
          statement_id: string
          status?: Database["public"]["Enums"]["statement_line_status"]
          transaction_date: string
          value_date?: string | null
        }
        Update: {
          amount?: number
          community_id?: string
          description?: string
          id?: string
          line_number?: number
          match_confidence?: number | null
          matched_at?: string | null
          matched_by?: string | null
          matched_transaction_id?: string | null
          notes?: string | null
          reference?: string | null
          statement_id?: string
          status?: Database["public"]["Enums"]["statement_line_status"]
          transaction_date?: string
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string
          closing_balance: number
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          import_format: string | null
          imported_at: string
          imported_by: string | null
          is_reconciled: boolean
          line_count: number
          lines_matched: number
          lines_unmatched: number
          opening_balance: number
          original_filename: string | null
          period_end: string
          period_start: string
          reconciled_at: string | null
          reconciled_by: string | null
          statement_date: string
          total_credits: number
          total_debits: number
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          closing_balance: number
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          import_format?: string | null
          imported_at?: string
          imported_by?: string | null
          is_reconciled?: boolean
          line_count?: number
          lines_matched?: number
          lines_unmatched?: number
          opening_balance: number
          original_filename?: string | null
          period_end: string
          period_start: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          statement_date: string
          total_credits?: number
          total_debits?: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          closing_balance?: number
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          import_format?: string | null
          imported_at?: string
          imported_by?: string | null
          is_reconciled?: boolean
          line_count?: number
          lines_matched?: number
          lines_unmatched?: number
          opening_balance?: number
          original_filename?: string | null
          period_end?: string
          period_start?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          statement_date?: string
          total_credits?: number
          total_debits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      blacklist_entries: {
        Row: {
          alert_guards: boolean
          approved_at: string | null
          approved_by: string | null
          community_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          effective_from: string
          evidence_documents: string[] | null
          evidence_photos: string[] | null
          expires_at: string | null
          id: string
          incident_date: string | null
          incident_description: string | null
          lifted_at: string | null
          lifted_by: string | null
          lifted_reason: string | null
          notify_admin: boolean
          person_document: string | null
          person_name: string
          person_photo_url: string | null
          protocol: string
          reason: string
          related_access_log_id: string | null
          related_incident_id: string | null
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
          vehicle_description: string | null
          vehicle_plate: string | null
          vehicle_plate_normalized: string | null
        }
        Insert: {
          alert_guards?: boolean
          approved_at?: string | null
          approved_by?: string | null
          community_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          effective_from?: string
          evidence_documents?: string[] | null
          evidence_photos?: string[] | null
          expires_at?: string | null
          id?: string
          incident_date?: string | null
          incident_description?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          lifted_reason?: string | null
          notify_admin?: boolean
          person_document?: string | null
          person_name: string
          person_photo_url?: string | null
          protocol?: string
          reason: string
          related_access_log_id?: string | null
          related_incident_id?: string | null
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
          vehicle_description?: string | null
          vehicle_plate?: string | null
          vehicle_plate_normalized?: string | null
        }
        Update: {
          alert_guards?: boolean
          approved_at?: string | null
          approved_by?: string | null
          community_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          effective_from?: string
          evidence_documents?: string[] | null
          evidence_photos?: string[] | null
          expires_at?: string | null
          id?: string
          incident_date?: string | null
          incident_description?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          lifted_reason?: string | null
          notify_admin?: boolean
          person_document?: string | null
          person_name?: string
          person_photo_url?: string | null
          protocol?: string
          reason?: string
          related_access_log_id?: string | null
          related_incident_id?: string | null
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
          vehicle_description?: string | null
          vehicle_plate?: string | null
          vehicle_plate_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_entries_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blacklist_entries_related_access_log_id_fkey"
            columns: ["related_access_log_id"]
            isOneToOne: false
            referencedRelation: "access_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          account_id: string
          actual_amount: number
          budget_id: string
          budgeted_amount: number
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          line_description: string | null
          notes: string | null
          updated_at: string
          variance: number | null
        }
        Insert: {
          account_id: string
          actual_amount?: number
          budget_id: string
          budgeted_amount: number
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          line_description?: string | null
          notes?: string | null
          updated_at?: string
          variance?: number | null
        }
        Update: {
          account_id?: string
          actual_amount?: number
          budget_id?: string
          budgeted_amount?: number
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          line_description?: string | null
          notes?: string | null
          updated_at?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assembly_minute_reference: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          fiscal_year: number
          id: string
          name: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["budget_status"]
          total_expense: number
          total_income: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assembly_minute_reference?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          fiscal_year: number
          id?: string
          name: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["budget_status"]
          total_expense?: number
          total_income?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assembly_minute_reference?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          fiscal_year?: number
          id?: string
          name?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["budget_status"]
          total_expense?: number
          total_income?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          allowed_roles: Database["public"]["Enums"]["user_role"][] | null
          anyone_can_post: boolean
          building: string | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_public: boolean
          name: string
          requires_moderation: boolean
          sort_order: number
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
        }
        Insert: {
          allowed_roles?: Database["public"]["Enums"]["user_role"][] | null
          anyone_can_post?: boolean
          building?: string | null
          channel_type?: Database["public"]["Enums"]["channel_type"]
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean
          name: string
          requires_moderation?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Update: {
          allowed_roles?: Database["public"]["Enums"]["user_role"][] | null
          anyone_can_post?: boolean
          building?: string | null
          channel_type?: Database["public"]["Enums"]["channel_type"]
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean
          name?: string
          requires_moderation?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          address: Json | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          email: string | null
          emergency_phone: string | null
          id: string
          locale: string
          logo_url: string | null
          name: string
          organization_id: string
          phone: string | null
          primary_color: string | null
          resident_count: number | null
          secondary_color: string | null
          settings: Json | null
          slug: string
          status: Database["public"]["Enums"]["general_status"]
          timezone: string
          unit_count: number | null
          updated_at: string
        }
        Insert: {
          address?: Json | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          emergency_phone?: string | null
          id?: string
          locale?: string
          logo_url?: string | null
          name: string
          organization_id: string
          phone?: string | null
          primary_color?: string | null
          resident_count?: number | null
          secondary_color?: string | null
          settings?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["general_status"]
          timezone?: string
          unit_count?: number | null
          updated_at?: string
        }
        Update: {
          address?: Json | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          emergency_phone?: string | null
          id?: string
          locale?: string
          logo_url?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          primary_color?: string | null
          resident_count?: number | null
          secondary_color?: string | null
          settings?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["general_status"]
          timezone?: string
          unit_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      community_settings: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          currency: string
          custom_rules: Json | null
          deleted_at: string | null
          emergency_phone: string | null
          feature_flags: Json
          guest_parking_allowed: boolean | null
          id: string
          locale: string
          logo_url: string | null
          management_email: string | null
          management_phone: string | null
          max_vehicles_per_unit: number | null
          office_days: number[] | null
          office_hours_end: string | null
          office_hours_start: string | null
          package_notification_channels: string[] | null
          package_retention_days: number | null
          pet_policy: string | null
          primary_color: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          secondary_color: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_rules?: Json | null
          deleted_at?: string | null
          emergency_phone?: string | null
          feature_flags?: Json
          guest_parking_allowed?: boolean | null
          id?: string
          locale?: string
          logo_url?: string | null
          management_email?: string | null
          management_phone?: string | null
          max_vehicles_per_unit?: number | null
          office_days?: number[] | null
          office_hours_end?: string | null
          office_hours_start?: string | null
          package_notification_channels?: string[] | null
          package_retention_days?: number | null
          pet_policy?: string | null
          primary_color?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          secondary_color?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_rules?: Json | null
          deleted_at?: string | null
          emergency_phone?: string | null
          feature_flags?: Json
          guest_parking_allowed?: boolean | null
          id?: string
          locale?: string
          logo_url?: string | null
          management_email?: string | null
          management_phone?: string | null
          max_vehicles_per_unit?: number | null
          office_days?: number[] | null
          office_hours_end?: string | null
          office_hours_start?: string | null
          package_notification_channels?: string[] | null
          package_retention_days?: number | null
          pet_policy?: string | null
          primary_color?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          secondary_color?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_settings_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: true
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          last_read_message_id: string | null
          left_at: string | null
          muted_until: string | null
          role: Database["public"]["Enums"]["participant_role"]
          unread_count: number
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          left_at?: string | null
          muted_until?: string | null
          role?: Database["public"]["Enums"]["participant_role"]
          unread_count?: number
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          left_at?: string | null
          muted_until?: string | null
          role?: Database["public"]["Enums"]["participant_role"]
          unread_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          access_point_id: string | null
          avatar_url: string | null
          community_id: string
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_archived: boolean
          last_message_at: string | null
          last_message_preview: string | null
          message_count: number
          name: string | null
          participant_count: number
          shift_date: string | null
          updated_at: string
        }
        Insert: {
          access_point_id?: string | null
          avatar_url?: string | null
          community_id: string
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          message_count?: number
          name?: string | null
          participant_count?: number
          shift_date?: string | null
          updated_at?: string
        }
        Update: {
          access_point_id?: string | null
          avatar_url?: string | null
          community_id?: string
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          message_count?: number
          name?: string | null
          participant_count?: number
          shift_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      delinquency_actions: {
        Row: {
          action_description: string
          action_type: Database["public"]["Enums"]["delinquency_action_type"]
          balance_at_action: number
          community_id: string
          days_overdue_at_action: number
          executed_at: string
          executed_by: string | null
          failure_reason: string | null
          id: string
          related_notification_id: string | null
          related_transaction_id: string | null
          status: string
          trigger_id: string | null
          unit_id: string
        }
        Insert: {
          action_description: string
          action_type: Database["public"]["Enums"]["delinquency_action_type"]
          balance_at_action: number
          community_id: string
          days_overdue_at_action: number
          executed_at?: string
          executed_by?: string | null
          failure_reason?: string | null
          id?: string
          related_notification_id?: string | null
          related_transaction_id?: string | null
          status?: string
          trigger_id?: string | null
          unit_id: string
        }
        Update: {
          action_description?: string
          action_type?: Database["public"]["Enums"]["delinquency_action_type"]
          balance_at_action?: number
          community_id?: string
          days_overdue_at_action?: number
          executed_at?: string
          executed_by?: string | null
          failure_reason?: string | null
          id?: string
          related_notification_id?: string | null
          related_transaction_id?: string | null
          status?: string
          trigger_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delinquency_actions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delinquency_actions_related_transaction_id_fkey"
            columns: ["related_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delinquency_actions_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "delinquency_triggers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delinquency_actions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "delinquency_actions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      delinquency_triggers: {
        Row: {
          action_config: Json
          action_type: Database["public"]["Enums"]["delinquency_action_type"]
          community_id: string
          created_at: string
          created_by: string | null
          days_overdue: number
          deleted_at: string | null
          fee_amount: number | null
          fee_description: string | null
          fee_percentage: number | null
          id: string
          is_active: boolean
          is_one_time: boolean
          min_amount: number
          notification_template_id: string | null
          priority: number
          repeat_interval_days: number | null
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: Database["public"]["Enums"]["delinquency_action_type"]
          community_id: string
          created_at?: string
          created_by?: string | null
          days_overdue: number
          deleted_at?: string | null
          fee_amount?: number | null
          fee_description?: string | null
          fee_percentage?: number | null
          id?: string
          is_active?: boolean
          is_one_time?: boolean
          min_amount?: number
          notification_template_id?: string | null
          priority?: number
          repeat_interval_days?: number | null
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: Database["public"]["Enums"]["delinquency_action_type"]
          community_id?: string
          created_at?: string
          created_by?: string | null
          days_overdue?: number
          deleted_at?: string | null
          fee_amount?: number | null
          fee_description?: string | null
          fee_percentage?: number | null
          id?: string
          is_active?: boolean
          is_one_time?: boolean
          min_amount?: number
          notification_template_id?: string | null
          priority?: number
          repeat_interval_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delinquency_triggers_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      document_permissions: {
        Row: {
          can_download: boolean
          can_edit: boolean
          can_view: boolean
          document_id: string
          expires_at: string | null
          granted_at: string
          granted_by: string
          id: string
          role: Database["public"]["Enums"]["user_role"] | null
          unit_id: string | null
          user_id: string | null
        }
        Insert: {
          can_download?: boolean
          can_edit?: boolean
          can_view?: boolean
          document_id: string
          expires_at?: string | null
          granted_at?: string
          granted_by: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          unit_id?: string | null
          user_id?: string | null
        }
        Update: {
          can_download?: boolean
          can_edit?: boolean
          can_view?: boolean
          document_id?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          unit_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_permissions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_permissions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "document_permissions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          change_summary: string | null
          checksum: string | null
          created_at: string
          document_id: string
          file_name: string
          file_size_bytes: number | null
          id: string
          mime_type: string
          previous_version_id: string | null
          storage_bucket: string
          storage_path: string
          uploaded_by: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          checksum?: string | null
          created_at?: string
          document_id: string
          file_name: string
          file_size_bytes?: number | null
          id?: string
          mime_type: string
          previous_version_id?: string | null
          storage_bucket?: string
          storage_path: string
          uploaded_by: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          checksum?: string | null
          created_at?: string
          document_id?: string
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string
          previous_version_id?: string | null
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          community_id: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_public: boolean
          name: string
          required_role: Database["public"]["Enums"]["user_role"] | null
          requires_signature: boolean
          signature_deadline: string | null
          status: Database["public"]["Enums"]["general_status"]
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["document_category"]
          community_id: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          required_role?: Database["public"]["Enums"]["user_role"] | null
          requires_signature?: boolean
          signature_deadline?: string | null
          status?: Database["public"]["Enums"]["general_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          community_id?: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          required_role?: Database["public"]["Enums"]["user_role"] | null
          requires_signature?: boolean
          signature_deadline?: string | null
          status?: Database["public"]["Enums"]["general_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      election_options: {
        Row: {
          candidate_photo_url: string | null
          candidate_resident_id: string | null
          coefficient_total: number
          created_at: string
          description: string | null
          display_order: number
          election_id: string
          id: string
          title: string
          votes_count: number
        }
        Insert: {
          candidate_photo_url?: string | null
          candidate_resident_id?: string | null
          coefficient_total?: number
          created_at?: string
          description?: string | null
          display_order?: number
          election_id: string
          id?: string
          title: string
          votes_count?: number
        }
        Update: {
          candidate_photo_url?: string | null
          candidate_resident_id?: string | null
          coefficient_total?: number
          created_at?: string
          description?: string | null
          display_order?: number
          election_id?: string
          id?: string
          title?: string
          votes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "election_options_candidate_resident_id_fkey"
            columns: ["candidate_resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_options_candidate_resident_id_fkey"
            columns: ["candidate_resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "election_options_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          assembly_id: string | null
          certified_at: string | null
          certified_by: string | null
          closes_at: string
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          election_number: string
          election_type: Database["public"]["Enums"]["election_type"]
          id: string
          max_options_selectable: number
          min_options_selectable: number
          opens_at: string
          quorum_met: boolean | null
          quorum_required: number
          status: Database["public"]["Enums"]["election_status"]
          title: string
          total_coefficient_voted: number
          updated_at: string
        }
        Insert: {
          assembly_id?: string | null
          certified_at?: string | null
          certified_by?: string | null
          closes_at: string
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          election_number: string
          election_type: Database["public"]["Enums"]["election_type"]
          id?: string
          max_options_selectable?: number
          min_options_selectable?: number
          opens_at: string
          quorum_met?: boolean | null
          quorum_required?: number
          status?: Database["public"]["Enums"]["election_status"]
          title: string
          total_coefficient_voted?: number
          updated_at?: string
        }
        Update: {
          assembly_id?: string | null
          certified_at?: string | null
          certified_by?: string | null
          closes_at?: string
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          election_number?: string
          election_type?: Database["public"]["Enums"]["election_type"]
          id?: string
          max_options_selectable?: number
          min_options_selectable?: number
          opens_at?: string
          quorum_met?: boolean | null
          quorum_required?: number
          status?: Database["public"]["Enums"]["election_status"]
          title?: string
          total_coefficient_voted?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elections_assembly_fk"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elections_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_alerts: {
        Row: {
          access_point_id: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          audio_recording_url: string | null
          community_id: string
          created_at: string
          emergency_type: Database["public"]["Enums"]["emergency_type"]
          escalated_at: string | null
          escalated_to_911: boolean
          external_reference: string | null
          id: string
          location_description: string | null
          location_lat: number | null
          location_lng: number | null
          on_scene_at: string | null
          photos: string[] | null
          priority: Database["public"]["Enums"]["priority_level"]
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          response_started_at: string | null
          status: Database["public"]["Enums"]["emergency_status"]
          triggered_at: string
          triggered_by: string | null
          triggered_by_name: string | null
          triggered_by_unit_id: string | null
          updated_at: string
        }
        Insert: {
          access_point_id?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          audio_recording_url?: string | null
          community_id: string
          created_at?: string
          emergency_type: Database["public"]["Enums"]["emergency_type"]
          escalated_at?: string | null
          escalated_to_911?: boolean
          external_reference?: string | null
          id?: string
          location_description?: string | null
          location_lat?: number | null
          location_lng?: number | null
          on_scene_at?: string | null
          photos?: string[] | null
          priority?: Database["public"]["Enums"]["priority_level"]
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_started_at?: string | null
          status?: Database["public"]["Enums"]["emergency_status"]
          triggered_at?: string
          triggered_by?: string | null
          triggered_by_name?: string | null
          triggered_by_unit_id?: string | null
          updated_at?: string
        }
        Update: {
          access_point_id?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          audio_recording_url?: string | null
          community_id?: string
          created_at?: string
          emergency_type?: Database["public"]["Enums"]["emergency_type"]
          escalated_at?: string | null
          escalated_to_911?: boolean
          external_reference?: string | null
          id?: string
          location_description?: string | null
          location_lat?: number | null
          location_lng?: number | null
          on_scene_at?: string | null
          photos?: string[] | null
          priority?: Database["public"]["Enums"]["priority_level"]
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_started_at?: string | null
          status?: Database["public"]["Enums"]["emergency_status"]
          triggered_at?: string
          triggered_by?: string | null
          triggered_by_name?: string | null
          triggered_by_unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_alerts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_alerts_triggered_by_unit_id_fkey"
            columns: ["triggered_by_unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "emergency_alerts_triggered_by_unit_id_fkey"
            columns: ["triggered_by_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          address: string | null
          city: string | null
          community_id: string
          contact_for: string[]
          contact_name: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone_primary: string
          phone_secondary: string | null
          priority: number
          relationship: Database["public"]["Enums"]["emergency_contact_relationship"]
          resident_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          community_id: string
          contact_for?: string[]
          contact_name: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone_primary: string
          phone_secondary?: string | null
          priority?: number
          relationship: Database["public"]["Enums"]["emergency_contact_relationship"]
          resident_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          community_id?: string
          contact_for?: string[]
          contact_name?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone_primary?: string
          phone_secondary?: string | null
          priority?: number
          relationship?: Database["public"]["Enums"]["emergency_contact_relationship"]
          resident_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_contacts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_contacts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      emergency_responders: {
        Row: {
          acknowledged_at: string | null
          arrived_at: string | null
          assigned_at: string
          assigned_by: string | null
          departed_at: string | null
          emergency_alert_id: string
          guard_id: string
          id: string
          notes: string | null
          status: string
        }
        Insert: {
          acknowledged_at?: string | null
          arrived_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          departed_at?: string | null
          emergency_alert_id: string
          guard_id: string
          id?: string
          notes?: string | null
          status?: string
        }
        Update: {
          acknowledged_at?: string | null
          arrived_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          departed_at?: string | null
          emergency_alert_id?: string
          guard_id?: string
          id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_responders_emergency_alert_id_fkey"
            columns: ["emergency_alert_id"]
            isOneToOne: false
            referencedRelation: "emergency_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_responders_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          action_target: string | null
          action_type: string
          applies_to_category_id: string | null
          applies_to_priority:
            | Database["public"]["Enums"]["ticket_priority"][]
            | null
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          notification_template: string | null
          priority: number
          trigger_threshold: number
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_target?: string | null
          action_type: string
          applies_to_category_id?: string | null
          applies_to_priority?:
            | Database["public"]["Enums"]["ticket_priority"][]
            | null
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          notification_template?: string | null
          priority?: number
          trigger_threshold: number
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_target?: string | null
          action_type?: string
          applies_to_category_id?: string | null
          applies_to_priority?:
            | Database["public"]["Enums"]["ticket_priority"][]
            | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notification_template?: string | null
          priority?: number
          trigger_threshold?: number
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_rules_applies_to_category_id_fkey"
            columns: ["applies_to_category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_rules_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_appointments: {
        Row: {
          buyer_confirmed: boolean | null
          buyer_id: string
          community_id: string
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          duration_minutes: number
          exchange_zone_id: string
          id: string
          listing_id: string
          notes: string | null
          scheduled_at: string
          seller_confirmed: boolean | null
          seller_id: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          buyer_confirmed?: boolean | null
          buyer_id: string
          community_id: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number
          exchange_zone_id: string
          id?: string
          listing_id: string
          notes?: string | null
          scheduled_at: string
          seller_confirmed?: boolean | null
          seller_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          buyer_confirmed?: boolean | null
          buyer_id?: string
          community_id?: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number
          exchange_zone_id?: string
          id?: string
          listing_id?: string
          notes?: string | null
          scheduled_at?: string
          seller_confirmed?: boolean | null
          seller_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_appointments_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_appointments_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "exchange_appointments_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_appointments_exchange_zone_id_fkey"
            columns: ["exchange_zone_id"]
            isOneToOne: false
            referencedRelation: "exchange_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_appointments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_appointments_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_appointments_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      exchange_zones: {
        Row: {
          amenity_id: string | null
          available_hours: Json | null
          community_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          has_lighting: boolean
          has_video_surveillance: boolean
          id: string
          is_indoor: boolean
          latitude: number | null
          location_instructions: string | null
          longitude: number | null
          name: string
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
        }
        Insert: {
          amenity_id?: string | null
          available_hours?: Json | null
          community_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          has_lighting?: boolean
          has_video_surveillance?: boolean
          id?: string
          is_indoor?: boolean
          latitude?: number | null
          location_instructions?: string | null
          longitude?: number | null
          name: string
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Update: {
          amenity_id?: string | null
          available_hours?: Json | null
          community_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          has_lighting?: boolean
          has_video_surveillance?: boolean
          id?: string
          is_indoor?: boolean
          latitude?: number | null
          location_instructions?: string | null
          longitude?: number | null
          name?: string
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_zones_amenity_fk"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_zones_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_schedules: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          effective_until: string | null
          fee_structure_id: string
          id: string
          is_active: boolean
          override_amount: number | null
          override_reason: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_until?: string | null
          fee_structure_id: string
          id?: string
          is_active?: boolean
          override_amount?: number | null
          override_reason?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_until?: string | null
          fee_structure_id?: string
          id?: string
          is_active?: boolean
          override_amount?: number | null
          override_reason?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_schedules_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_schedules_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_schedules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "fee_schedules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          applicable_unit_types:
            | Database["public"]["Enums"]["unit_type"][]
            | null
          base_amount: number
          calculation_type: Database["public"]["Enums"]["fee_calculation_type"]
          code: string | null
          coefficient_amount: number | null
          community_id: string
          created_at: string
          created_by: string | null
          custom_formula: Json | null
          day_of_month: number | null
          deleted_at: string | null
          description: string | null
          effective_from: string
          effective_until: string | null
          frequency: Database["public"]["Enums"]["fee_frequency"]
          id: string
          income_account_id: string
          is_active: boolean
          name: string
          receivable_account_id: string
          updated_at: string
        }
        Insert: {
          applicable_unit_types?:
            | Database["public"]["Enums"]["unit_type"][]
            | null
          base_amount: number
          calculation_type: Database["public"]["Enums"]["fee_calculation_type"]
          code?: string | null
          coefficient_amount?: number | null
          community_id: string
          created_at?: string
          created_by?: string | null
          custom_formula?: Json | null
          day_of_month?: number | null
          deleted_at?: string | null
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          frequency: Database["public"]["Enums"]["fee_frequency"]
          id?: string
          income_account_id: string
          is_active?: boolean
          name: string
          receivable_account_id: string
          updated_at?: string
        }
        Update: {
          applicable_unit_types?:
            | Database["public"]["Enums"]["unit_type"][]
            | null
          base_amount?: number
          calculation_type?: Database["public"]["Enums"]["fee_calculation_type"]
          code?: string | null
          coefficient_amount?: number | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          custom_formula?: Json | null
          day_of_month?: number | null
          deleted_at?: string | null
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          frequency?: Database["public"]["Enums"]["fee_frequency"]
          id?: string
          income_account_id?: string
          is_active?: boolean
          name?: string
          receivable_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_receivable_account_id_fkey"
            columns: ["receivable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_certifications: {
        Row: {
          certificate_number: string | null
          certification_type: string
          created_at: string
          deleted_at: string | null
          document_url: string | null
          expires_at: string | null
          guard_id: string
          id: string
          issued_at: string
          issuing_authority: string | null
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
        }
        Insert: {
          certificate_number?: string | null
          certification_type: string
          created_at?: string
          deleted_at?: string | null
          document_url?: string | null
          expires_at?: string | null
          guard_id: string
          id?: string
          issued_at: string
          issuing_authority?: string | null
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Update: {
          certificate_number?: string | null
          certification_type?: string
          created_at?: string
          deleted_at?: string | null
          document_url?: string | null
          expires_at?: string | null
          guard_id?: string
          id?: string
          issued_at?: string
          issuing_authority?: string | null
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_certifications_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_shifts: {
        Row: {
          applicable_days: number[] | null
          community_id: string
          created_at: string
          crosses_midnight: boolean | null
          deleted_at: string | null
          end_time: string
          id: string
          name: string
          start_time: string
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
        }
        Insert: {
          applicable_days?: number[] | null
          community_id: string
          created_at?: string
          crosses_midnight?: boolean | null
          deleted_at?: string | null
          end_time: string
          id?: string
          name: string
          start_time: string
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Update: {
          applicable_days?: number[] | null
          community_id?: string
          created_at?: string
          crosses_midnight?: boolean | null
          deleted_at?: string | null
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_shifts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      guards: {
        Row: {
          community_id: string
          created_at: string
          curp: string | null
          deleted_at: string | null
          email: string | null
          employee_number: string | null
          employment_status: Database["public"]["Enums"]["general_status"]
          first_name: string
          full_name: string | null
          hired_at: string | null
          id: string
          ine_number: string | null
          maternal_surname: string | null
          paternal_surname: string
          phone: string
          phone_emergency: string | null
          photo_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          community_id: string
          created_at?: string
          curp?: string | null
          deleted_at?: string | null
          email?: string | null
          employee_number?: string | null
          employment_status?: Database["public"]["Enums"]["general_status"]
          first_name: string
          full_name?: string | null
          hired_at?: string | null
          id?: string
          ine_number?: string | null
          maternal_surname?: string | null
          paternal_surname: string
          phone: string
          phone_emergency?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          community_id?: string
          created_at?: string
          curp?: string | null
          deleted_at?: string | null
          email?: string | null
          employee_number?: string | null
          employment_status?: Database["public"]["Enums"]["general_status"]
          first_name?: string
          full_name?: string | null
          hired_at?: string | null
          id?: string
          ine_number?: string | null
          maternal_surname?: string | null
          paternal_surname?: string
          phone?: string
          phone_emergency?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guards_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assigned_to: string
          id: string
          incident_id: string
          notes: string | null
          role: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_to: string
          id?: string
          incident_id: string
          notes?: string | null
          role?: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_to?: string
          id?: string
          incident_id?: string
          notes?: string | null
          role?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_assignments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_media: {
        Row: {
          caption: string | null
          community_id: string
          created_at: string
          file_name: string
          file_size_bytes: number | null
          id: string
          incident_id: string
          media_type: string
          mime_type: string | null
          storage_path: string
          taken_at: string | null
          transcription: string | null
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          community_id: string
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          id?: string
          incident_id: string
          media_type: string
          mime_type?: string | null
          storage_path: string
          taken_at?: string | null
          transcription?: string | null
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          community_id?: string
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          incident_id?: string
          media_type?: string
          mime_type?: string | null
          storage_path?: string
          taken_at?: string | null
          transcription?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_media_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_media_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_types: {
        Row: {
          category: string
          community_id: string
          created_at: string
          default_priority: number
          default_severity: Database["public"]["Enums"]["incident_severity"]
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sla_resolution_hours: number | null
          sla_response_hours: number | null
          updated_at: string
        }
        Insert: {
          category: string
          community_id: string
          created_at?: string
          default_priority?: number
          default_severity?: Database["public"]["Enums"]["incident_severity"]
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sla_resolution_hours?: number | null
          sla_response_hours?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          community_id?: string
          created_at?: string
          default_priority?: number
          default_severity?: Database["public"]["Enums"]["incident_severity"]
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sla_resolution_hours?: number | null
          sla_response_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_types_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          access_point_id: string | null
          assigned_at: string | null
          assigned_to: string | null
          community_id: string
          created_at: string
          deleted_at: string | null
          description: string
          first_response_at: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          incident_number: string
          incident_type_id: string | null
          location_description: string | null
          location_type: string | null
          priority: number
          reported_at: string
          reported_by: string | null
          reported_by_guard: string | null
          reporter_name: string | null
          reporter_phone: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          status_changed_at: string
          timeline: Json
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          access_point_id?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          community_id: string
          created_at?: string
          deleted_at?: string | null
          description: string
          first_response_at?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          incident_number: string
          incident_type_id?: string | null
          location_description?: string | null
          location_type?: string | null
          priority?: number
          reported_at?: string
          reported_by?: string | null
          reported_by_guard?: string | null
          reporter_name?: string | null
          reporter_phone?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          status_changed_at?: string
          timeline?: Json
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          access_point_id?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          community_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          first_response_at?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          incident_number?: string
          incident_type_id?: string | null
          location_description?: string | null
          location_type?: string | null
          priority?: number
          reported_at?: string
          reported_by?: string | null
          reported_by_guard?: string | null
          reporter_name?: string | null
          reporter_phone?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          status_changed_at?: string
          timeline?: Json
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_incident_type_id_fkey"
            columns: ["incident_type_id"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "incidents_reported_by_guard_fkey"
            columns: ["reported_by_guard"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "incidents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          allowed_access_points: string[] | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          community_id: string
          created_at: string
          created_by_resident_id: string
          deleted_at: string | null
          event_guests_checked_in: number
          event_max_guests: number | null
          event_name: string | null
          id: string
          invitation_type: Database["public"]["Enums"]["invitation_type"]
          last_used_at: string | null
          max_uses: number | null
          recurring_days: number[] | null
          recurring_end_time: string | null
          recurring_start_time: string | null
          requires_document: boolean
          requires_photo: boolean
          special_instructions: string | null
          status: Database["public"]["Enums"]["approval_status"]
          times_used: number
          unit_id: string | null
          updated_at: string
          valid_from: string
          valid_until: string | null
          vehicle_color: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_plate_normalized: string | null
          visitor_company: string | null
          visitor_document: string | null
          visitor_email: string | null
          visitor_name: string
          visitor_phone: string | null
        }
        Insert: {
          allowed_access_points?: string[] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          community_id: string
          created_at?: string
          created_by_resident_id: string
          deleted_at?: string | null
          event_guests_checked_in?: number
          event_max_guests?: number | null
          event_name?: string | null
          id?: string
          invitation_type: Database["public"]["Enums"]["invitation_type"]
          last_used_at?: string | null
          max_uses?: number | null
          recurring_days?: number[] | null
          recurring_end_time?: string | null
          recurring_start_time?: string | null
          requires_document?: boolean
          requires_photo?: boolean
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          times_used?: number
          unit_id?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_plate_normalized?: string | null
          visitor_company?: string | null
          visitor_document?: string | null
          visitor_email?: string | null
          visitor_name: string
          visitor_phone?: string | null
        }
        Update: {
          allowed_access_points?: string[] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          community_id?: string
          created_at?: string
          created_by_resident_id?: string
          deleted_at?: string | null
          event_guests_checked_in?: number
          event_max_guests?: number | null
          event_name?: string | null
          id?: string
          invitation_type?: Database["public"]["Enums"]["invitation_type"]
          last_used_at?: string | null
          max_uses?: number | null
          recurring_days?: number[] | null
          recurring_end_time?: string | null
          recurring_start_time?: string | null
          requires_document?: boolean
          requires_photo?: boolean
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          times_used?: number
          unit_id?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_plate_normalized?: string | null
          visitor_company?: string | null
          visitor_document?: string | null
          visitor_email?: string | null
          visitor_name?: string
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_created_by_resident_id_fkey"
            columns: ["created_by_resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_created_by_resident_id_fkey"
            columns: ["created_by_resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "invitations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "invitations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_daily: {
        Row: {
          announcements_sent: number | null
          community_id: string
          computed_at: string
          created_at: string
          denied_entries: number | null
          entries_by_hour: Json | null
          id: string
          incidents_reported: number | null
          incidents_resolved: number | null
          messages_sent: number | null
          metric_date: string
          new_charges_amount: number | null
          new_charges_count: number | null
          no_shows: number | null
          packages_pending: number | null
          packages_picked_up: number | null
          packages_received: number | null
          patrol_checkpoints_completed: number | null
          patrol_checkpoints_missed: number | null
          payments_amount: number | null
          payments_received: number | null
          reservations_cancelled: number | null
          reservations_made: number | null
          resident_entries: number | null
          tickets_closed: number | null
          tickets_opened: number | null
          total_delinquent_amount: number | null
          total_entries: number | null
          units_delinquent: number | null
          updated_at: string
          visitor_entries: number | null
        }
        Insert: {
          announcements_sent?: number | null
          community_id: string
          computed_at?: string
          created_at?: string
          denied_entries?: number | null
          entries_by_hour?: Json | null
          id?: string
          incidents_reported?: number | null
          incidents_resolved?: number | null
          messages_sent?: number | null
          metric_date: string
          new_charges_amount?: number | null
          new_charges_count?: number | null
          no_shows?: number | null
          packages_pending?: number | null
          packages_picked_up?: number | null
          packages_received?: number | null
          patrol_checkpoints_completed?: number | null
          patrol_checkpoints_missed?: number | null
          payments_amount?: number | null
          payments_received?: number | null
          reservations_cancelled?: number | null
          reservations_made?: number | null
          resident_entries?: number | null
          tickets_closed?: number | null
          tickets_opened?: number | null
          total_delinquent_amount?: number | null
          total_entries?: number | null
          units_delinquent?: number | null
          updated_at?: string
          visitor_entries?: number | null
        }
        Update: {
          announcements_sent?: number | null
          community_id?: string
          computed_at?: string
          created_at?: string
          denied_entries?: number | null
          entries_by_hour?: Json | null
          id?: string
          incidents_reported?: number | null
          incidents_resolved?: number | null
          messages_sent?: number | null
          metric_date?: string
          new_charges_amount?: number | null
          new_charges_count?: number | null
          no_shows?: number | null
          packages_pending?: number | null
          packages_picked_up?: number | null
          packages_received?: number | null
          patrol_checkpoints_completed?: number | null
          patrol_checkpoints_missed?: number | null
          payments_amount?: number | null
          payments_received?: number | null
          reservations_cancelled?: number | null
          reservations_made?: number | null
          resident_entries?: number | null
          tickets_closed?: number | null
          tickets_opened?: number | null
          total_delinquent_amount?: number | null
          total_entries?: number | null
          units_delinquent?: number | null
          updated_at?: string
          visitor_entries?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_daily_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_monthly: {
        Row: {
          avg_pickup_days: number | null
          avg_resolution_hours: number | null
          avg_ticket_resolution_hours: number | null
          collection_rate: number | null
          collection_rate_change: number | null
          community_id: string
          computed_at: string
          created_at: string
          id: string
          incidents_by_category: Json | null
          month: number
          packages_picked_up: number | null
          packages_received: number | null
          tickets_closed: number | null
          tickets_opened: number | null
          total_billed: number | null
          total_collected: number | null
          total_delinquent_amount: number | null
          total_entries: number | null
          total_incidents: number | null
          total_reservations: number | null
          unique_visitors: number | null
          units_delinquent_30_days: number | null
          units_delinquent_60_days: number | null
          units_delinquent_90_days: number | null
          updated_at: string
          utilization_by_amenity: Json | null
          year: number
        }
        Insert: {
          avg_pickup_days?: number | null
          avg_resolution_hours?: number | null
          avg_ticket_resolution_hours?: number | null
          collection_rate?: number | null
          collection_rate_change?: number | null
          community_id: string
          computed_at?: string
          created_at?: string
          id?: string
          incidents_by_category?: Json | null
          month: number
          packages_picked_up?: number | null
          packages_received?: number | null
          tickets_closed?: number | null
          tickets_opened?: number | null
          total_billed?: number | null
          total_collected?: number | null
          total_delinquent_amount?: number | null
          total_entries?: number | null
          total_incidents?: number | null
          total_reservations?: number | null
          unique_visitors?: number | null
          units_delinquent_30_days?: number | null
          units_delinquent_60_days?: number | null
          units_delinquent_90_days?: number | null
          updated_at?: string
          utilization_by_amenity?: Json | null
          year: number
        }
        Update: {
          avg_pickup_days?: number | null
          avg_resolution_hours?: number | null
          avg_ticket_resolution_hours?: number | null
          collection_rate?: number | null
          collection_rate_change?: number | null
          community_id?: string
          computed_at?: string
          created_at?: string
          id?: string
          incidents_by_category?: Json | null
          month?: number
          packages_picked_up?: number | null
          packages_received?: number | null
          tickets_closed?: number | null
          tickets_opened?: number | null
          total_billed?: number | null
          total_collected?: number | null
          total_delinquent_amount?: number | null
          total_entries?: number | null
          total_incidents?: number | null
          total_reservations?: number | null
          unique_visitors?: number | null
          units_delinquent_30_days?: number | null
          units_delinquent_60_days?: number | null
          units_delinquent_90_days?: number | null
          updated_at?: string
          utilization_by_amenity?: Json | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_monthly_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_weekly: {
        Row: {
          avg_daily_entries: number | null
          community_id: string
          computed_at: string
          created_at: string
          entries_change_pct: number | null
          id: string
          incidents_change_pct: number | null
          incidents_reported: number | null
          incidents_resolved: number | null
          packages_picked_up: number | null
          packages_received: number | null
          payments_amount: number | null
          payments_change_pct: number | null
          tickets_closed: number | null
          tickets_opened: number | null
          total_entries: number | null
          updated_at: string
          week_number: number
          week_start: string
          year: number
        }
        Insert: {
          avg_daily_entries?: number | null
          community_id: string
          computed_at?: string
          created_at?: string
          entries_change_pct?: number | null
          id?: string
          incidents_change_pct?: number | null
          incidents_reported?: number | null
          incidents_resolved?: number | null
          packages_picked_up?: number | null
          packages_received?: number | null
          payments_amount?: number | null
          payments_change_pct?: number | null
          tickets_closed?: number | null
          tickets_opened?: number | null
          total_entries?: number | null
          updated_at?: string
          week_number: number
          week_start: string
          year: number
        }
        Update: {
          avg_daily_entries?: number | null
          community_id?: string
          computed_at?: string
          created_at?: string
          entries_change_pct?: number | null
          id?: string
          incidents_change_pct?: number | null
          incidents_reported?: number | null
          incidents_resolved?: number | null
          packages_picked_up?: number | null
          packages_received?: number | null
          payments_amount?: number | null
          payments_change_pct?: number | null
          tickets_closed?: number | null
          tickets_opened?: number | null
          total_entries?: number | null
          updated_at?: string
          week_number?: number
          week_start?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_weekly_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          amount: number
          balance_after: number | null
          community_id: string
          created_at: string
          entry_sequence: number
          id: string
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount: number
          balance_after?: number | null
          community_id: string
          created_at?: string
          entry_sequence: number
          id?: string
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number | null
          community_id?: string
          created_at?: string
          entry_sequence?: number
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          auto_flag_reasons: string[] | null
          category: Database["public"]["Enums"]["listing_category"]
          community_id: string
          created_at: string
          deleted_at: string | null
          description: string
          expires_at: string
          id: string
          image_urls: string[] | null
          inquiry_count: number
          is_sold: boolean
          moderated_at: string | null
          moderated_by: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          preferred_exchange_zone_id: string | null
          price: number | null
          price_negotiable: boolean
          rejection_reason: string | null
          seller_id: string
          sold_at: string | null
          sold_to_resident_id: string | null
          title: string
          unit_id: string | null
          updated_at: string
          view_count: number
        }
        Insert: {
          auto_flag_reasons?: string[] | null
          category: Database["public"]["Enums"]["listing_category"]
          community_id: string
          created_at?: string
          deleted_at?: string | null
          description: string
          expires_at?: string
          id?: string
          image_urls?: string[] | null
          inquiry_count?: number
          is_sold?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          preferred_exchange_zone_id?: string | null
          price?: number | null
          price_negotiable?: boolean
          rejection_reason?: string | null
          seller_id: string
          sold_at?: string | null
          sold_to_resident_id?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          auto_flag_reasons?: string[] | null
          category?: Database["public"]["Enums"]["listing_category"]
          community_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          expires_at?: string
          id?: string
          image_urls?: string[] | null
          inquiry_count?: number
          is_sold?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          preferred_exchange_zone_id?: string | null
          price?: number | null
          price_negotiable?: boolean
          rejection_reason?: string | null
          seller_id?: string
          sold_at?: string | null
          sold_to_resident_id?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_exchange_zone_fk"
            columns: ["preferred_exchange_zone_id"]
            isOneToOne: false
            referencedRelation: "exchange_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "marketplace_listings_sold_to_resident_id_fkey"
            columns: ["sold_to_resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_sold_to_resident_id_fkey"
            columns: ["sold_to_resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "marketplace_listings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "marketplace_listings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_conditions: {
        Row: {
          community_id: string
          condition_name: string
          condition_type: Database["public"]["Enums"]["medical_condition_type"]
          created_at: string
          deleted_at: string | null
          description: string | null
          doctor_name: string | null
          doctor_phone: string | null
          document_url: string | null
          emergency_instructions: string | null
          hospital_preference: string | null
          id: string
          medications: string[] | null
          reaction_description: string | null
          resident_id: string
          severity: Database["public"]["Enums"]["medical_severity"] | null
          share_with_neighbors: boolean
          share_with_security: boolean
          updated_at: string
        }
        Insert: {
          community_id: string
          condition_name: string
          condition_type: Database["public"]["Enums"]["medical_condition_type"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          document_url?: string | null
          emergency_instructions?: string | null
          hospital_preference?: string | null
          id?: string
          medications?: string[] | null
          reaction_description?: string | null
          resident_id: string
          severity?: Database["public"]["Enums"]["medical_severity"] | null
          share_with_neighbors?: boolean
          share_with_security?: boolean
          updated_at?: string
        }
        Update: {
          community_id?: string
          condition_name?: string
          condition_type?: Database["public"]["Enums"]["medical_condition_type"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          document_url?: string | null
          emergency_instructions?: string | null
          hospital_preference?: string | null
          id?: string
          medications?: string[] | null
          reaction_description?: string | null
          resident_id?: string
          severity?: Database["public"]["Enums"]["medical_severity"] | null
          share_with_neighbors?: boolean
          share_with_security?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_conditions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_conditions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_conditions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean
          is_edited: boolean
          media_types: string[] | null
          media_urls: string[] | null
          message_type: string
          original_content: string | null
          reply_to_message_id: string | null
          sender_id: string
          system_data: Json | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          media_types?: string[] | null
          media_urls?: string[] | null
          message_type?: string
          original_content?: string | null
          reply_to_message_id?: string | null
          sender_id: string
          system_data?: Json | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          media_types?: string[] | null
          media_urls?: string[] | null
          message_type?: string
          original_content?: string | null
          reply_to_message_id?: string | null
          sender_id?: string
          system_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_queue: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          community_id: string
          id: string
          item_id: string
          item_type: string
          priority: number
          queued_at: string
          resolution: string | null
          resolution_notes: string | null
          resolved_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          community_id: string
          id?: string
          item_id: string
          item_type: string
          priority?: number
          queued_at?: string
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          community_id?: string
          id?: string
          item_id?: string
          item_type?: string
          priority?: number
          queued_at?: string
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_queue_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      move_deposits: {
        Row: {
          amount: number
          collected_at: string
          collected_by: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deduction_amount: number | null
          deduction_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_type: string
          id: string
          inspection_date: string | null
          inspection_notes: string | null
          inspection_photos: string[] | null
          move_request_id: string | null
          payment_method: string | null
          receipt_number: string | null
          refund_amount: number | null
          refund_approved_at: string | null
          refund_approved_by: string | null
          refund_method: string | null
          refund_processed_at: string | null
          refund_reference: string | null
          resident_id: string
          status: Database["public"]["Enums"]["deposit_status"]
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          collected_at?: string
          collected_by?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          deduction_amount?: number | null
          deduction_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_type?: string
          id?: string
          inspection_date?: string | null
          inspection_notes?: string | null
          inspection_photos?: string[] | null
          move_request_id?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          refund_amount?: number | null
          refund_approved_at?: string | null
          refund_approved_by?: string | null
          refund_method?: string | null
          refund_processed_at?: string | null
          refund_reference?: string | null
          resident_id: string
          status?: Database["public"]["Enums"]["deposit_status"]
          unit_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          collected_at?: string
          collected_by?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          deduction_amount?: number | null
          deduction_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_type?: string
          id?: string
          inspection_date?: string | null
          inspection_notes?: string | null
          inspection_photos?: string[] | null
          move_request_id?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          refund_amount?: number | null
          refund_approved_at?: string | null
          refund_approved_by?: string | null
          refund_method?: string | null
          refund_processed_at?: string | null
          refund_reference?: string | null
          resident_id?: string
          status?: Database["public"]["Enums"]["deposit_status"]
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_deposits_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_deposits_move_request_id_fkey"
            columns: ["move_request_id"]
            isOneToOne: false
            referencedRelation: "move_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_deposits_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_deposits_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "move_deposits_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "move_deposits_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      move_requests: {
        Row: {
          admin_notes: string | null
          all_validations_passed: boolean | null
          community_id: string
          completed_at: string | null
          completed_by: string | null
          confirmed_date: string | null
          confirmed_time_end: string | null
          confirmed_time_start: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          elevator_reserved: boolean | null
          estimated_duration_hours: number | null
          id: string
          loading_dock_reserved: boolean | null
          move_type: Database["public"]["Enums"]["move_type"]
          moving_company_name: string | null
          moving_company_phone: string | null
          moving_company_vehicle_plates: string[] | null
          requested_date: string
          requested_time_end: string | null
          requested_time_start: string | null
          resident_id: string
          resident_notes: string | null
          status: Database["public"]["Enums"]["move_status"]
          status_changed_at: string
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          all_validations_passed?: boolean | null
          community_id: string
          completed_at?: string | null
          completed_by?: string | null
          confirmed_date?: string | null
          confirmed_time_end?: string | null
          confirmed_time_start?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          elevator_reserved?: boolean | null
          estimated_duration_hours?: number | null
          id?: string
          loading_dock_reserved?: boolean | null
          move_type: Database["public"]["Enums"]["move_type"]
          moving_company_name?: string | null
          moving_company_phone?: string | null
          moving_company_vehicle_plates?: string[] | null
          requested_date: string
          requested_time_end?: string | null
          requested_time_start?: string | null
          resident_id: string
          resident_notes?: string | null
          status?: Database["public"]["Enums"]["move_status"]
          status_changed_at?: string
          unit_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          all_validations_passed?: boolean | null
          community_id?: string
          completed_at?: string | null
          completed_by?: string | null
          confirmed_date?: string | null
          confirmed_time_end?: string | null
          confirmed_time_start?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          elevator_reserved?: boolean | null
          estimated_duration_hours?: number | null
          id?: string
          loading_dock_reserved?: boolean | null
          move_type?: Database["public"]["Enums"]["move_type"]
          moving_company_name?: string | null
          moving_company_phone?: string | null
          moving_company_vehicle_plates?: string[] | null
          requested_date?: string
          requested_time_end?: string | null
          requested_time_start?: string | null
          resident_id?: string
          resident_notes?: string | null
          status?: Database["public"]["Enums"]["move_status"]
          status_changed_at?: string
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_requests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_requests_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_requests_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "move_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "move_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      move_validations: {
        Row: {
          balance_at_check: number | null
          checked_at: string | null
          checked_by: string | null
          created_at: string
          created_by: string | null
          id: string
          move_request_id: string
          notes: string | null
          status: Database["public"]["Enums"]["validation_status"]
          updated_at: string
          updated_by: string | null
          validation_type: string
          waived_by: string | null
          waiver_reason: string | null
        }
        Insert: {
          balance_at_check?: number | null
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          move_request_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          updated_at?: string
          updated_by?: string | null
          validation_type: string
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Update: {
          balance_at_check?: number | null
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          move_request_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          updated_at?: string
          updated_by?: string | null
          validation_type?: string
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_validations_move_request_id_fkey"
            columns: ["move_request_id"]
            isOneToOne: false
            referencedRelation: "move_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          community_id: string
          created_at: string
          data: Json | null
          dismissed_at: string | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          community_id: string
          created_at?: string
          data?: Json | null
          dismissed_at?: string | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          community_id?: string
          created_at?: string
          data?: Json | null
          dismissed_at?: string | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      occupancies: {
        Row: {
          authorized_by: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          occupancy_type: Database["public"]["Enums"]["occupancy_type"]
          resident_id: string
          start_date: string
          status: Database["public"]["Enums"]["general_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          authorized_by?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          occupancy_type: Database["public"]["Enums"]["occupancy_type"]
          resident_id: string
          start_date?: string
          status?: Database["public"]["Enums"]["general_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          authorized_by?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          occupancy_type?: Database["public"]["Enums"]["occupancy_type"]
          resident_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["general_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occupancies_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupancies_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "occupancies_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupancies_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupancies_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "occupancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "occupancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: Json | null
          billing_email: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          settings: Json | null
          slug: string
          status: Database["public"]["Enums"]["general_status"]
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: Json | null
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["general_status"]
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: Json | null
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["general_status"]
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      package_pickup_codes: {
        Row: {
          code_type: Database["public"]["Enums"]["pickup_code_type"]
          code_value: string
          community_id: string
          created_at: string
          id: string
          package_id: string
          sent_at: string | null
          sent_via: string[] | null
          signature: string | null
          status: Database["public"]["Enums"]["pickup_code_status"]
          used_at: string | null
          used_by: string | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          code_type?: Database["public"]["Enums"]["pickup_code_type"]
          code_value: string
          community_id: string
          created_at?: string
          id?: string
          package_id: string
          sent_at?: string | null
          sent_via?: string[] | null
          signature?: string | null
          status?: Database["public"]["Enums"]["pickup_code_status"]
          used_at?: string | null
          used_by?: string | null
          valid_from?: string
          valid_until: string
        }
        Update: {
          code_type?: Database["public"]["Enums"]["pickup_code_type"]
          code_value?: string
          community_id?: string
          created_at?: string
          id?: string
          package_id?: string
          sent_at?: string | null
          sent_via?: string[] | null
          signature?: string | null
          status?: Database["public"]["Enums"]["pickup_code_status"]
          used_at?: string | null
          used_by?: string | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_pickup_codes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_pickup_codes_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_signatures: {
        Row: {
          community_id: string
          consent_text: string
          created_at: string
          device_id: string | null
          device_type: string | null
          id: string
          ip_address: unknown
          package_id: string
          photo_url: string | null
          relationship_to_recipient: string | null
          signature_data: string | null
          signature_hash: string
          signature_type: string
          signed_at: string
          signed_by_name: string
          signed_by_resident_id: string | null
          user_agent: string
        }
        Insert: {
          community_id: string
          consent_text: string
          created_at?: string
          device_id?: string | null
          device_type?: string | null
          id?: string
          ip_address: unknown
          package_id: string
          photo_url?: string | null
          relationship_to_recipient?: string | null
          signature_data?: string | null
          signature_hash: string
          signature_type?: string
          signed_at?: string
          signed_by_name: string
          signed_by_resident_id?: string | null
          user_agent: string
        }
        Update: {
          community_id?: string
          consent_text?: string
          created_at?: string
          device_id?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          package_id?: string
          photo_url?: string | null
          relationship_to_recipient?: string | null
          signature_data?: string | null
          signature_hash?: string
          signature_type?: string
          signed_at?: string
          signed_by_name?: string
          signed_by_resident_id?: string | null
          user_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_signatures_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_signatures_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_signatures_signed_by_resident_id_fkey"
            columns: ["signed_by_resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_signatures_signed_by_resident_id_fkey"
            columns: ["signed_by_resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      package_storage_locations: {
        Row: {
          area: string | null
          community_id: string
          created_at: string
          current_count: number
          id: string
          is_available: boolean
          location_type: string
          max_packages: number | null
          name: string
          row_number: string | null
          shelf_number: string | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          community_id: string
          created_at?: string
          current_count?: number
          id?: string
          is_available?: boolean
          location_type: string
          max_packages?: number | null
          name: string
          row_number?: string | null
          shelf_number?: string | null
          updated_at?: string
        }
        Update: {
          area?: string | null
          community_id?: string
          created_at?: string
          current_count?: number
          id?: string
          is_available?: boolean
          location_type?: string
          max_packages?: number | null
          name?: string
          row_number?: string | null
          shelf_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_storage_locations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          abandonment_date: string | null
          carrier: Database["public"]["Enums"]["package_carrier"]
          carrier_other: string | null
          community_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_oversized: boolean
          is_perishable: boolean
          label_photo_url: string | null
          notified_at: string | null
          package_count: number
          photo_url: string | null
          picked_up_at: string | null
          picked_up_by: string | null
          received_at: string
          received_by: string | null
          recipient_name: string
          recipient_resident_id: string | null
          recipient_unit_id: string
          requires_signature: boolean
          retention_days: number
          special_instructions: string | null
          staff_notes: string | null
          status: Database["public"]["Enums"]["package_status"]
          status_changed_at: string
          storage_location_id: string | null
          stored_at: string | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          abandonment_date?: string | null
          carrier: Database["public"]["Enums"]["package_carrier"]
          carrier_other?: string | null
          community_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_oversized?: boolean
          is_perishable?: boolean
          label_photo_url?: string | null
          notified_at?: string | null
          package_count?: number
          photo_url?: string | null
          picked_up_at?: string | null
          picked_up_by?: string | null
          received_at?: string
          received_by?: string | null
          recipient_name: string
          recipient_resident_id?: string | null
          recipient_unit_id: string
          requires_signature?: boolean
          retention_days?: number
          special_instructions?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["package_status"]
          status_changed_at?: string
          storage_location_id?: string | null
          stored_at?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          abandonment_date?: string | null
          carrier?: Database["public"]["Enums"]["package_carrier"]
          carrier_other?: string | null
          community_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_oversized?: boolean
          is_perishable?: boolean
          label_photo_url?: string | null
          notified_at?: string | null
          package_count?: number
          photo_url?: string | null
          picked_up_at?: string | null
          picked_up_by?: string | null
          received_at?: string
          received_by?: string | null
          recipient_name?: string
          recipient_resident_id?: string | null
          recipient_unit_id?: string
          requires_signature?: boolean
          retention_days?: number
          special_instructions?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["package_status"]
          status_changed_at?: string
          storage_location_id?: string | null
          stored_at?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_recipient_resident_id_fkey"
            columns: ["recipient_resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_recipient_resident_id_fkey"
            columns: ["recipient_resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "packages_recipient_unit_id_fkey"
            columns: ["recipient_unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "packages_recipient_unit_id_fkey"
            columns: ["recipient_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "package_storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_assignments: {
        Row: {
          assigned_from: string
          assigned_until: string | null
          assignment_type: Database["public"]["Enums"]["parking_assignment_type"]
          community_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          monthly_rate: number | null
          notes: string | null
          parking_spot_id: string
          unit_id: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          assigned_from?: string
          assigned_until?: string | null
          assignment_type?: Database["public"]["Enums"]["parking_assignment_type"]
          community_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          monthly_rate?: number | null
          notes?: string | null
          parking_spot_id: string
          unit_id: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          assigned_from?: string
          assigned_until?: string | null
          assignment_type?: Database["public"]["Enums"]["parking_assignment_type"]
          community_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          monthly_rate?: number | null
          notes?: string | null
          parking_spot_id?: string
          unit_id?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_assignments_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_assignments_parking_spot_id_fkey"
            columns: ["parking_spot_id"]
            isOneToOne: false
            referencedRelation: "parking_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "parking_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_reservations: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          community_id: string
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          notes: string | null
          parking_spot_id: string
          reservation_date: string
          resident_id: string
          start_time: string
          status: Database["public"]["Enums"]["parking_reservation_status"]
          unit_id: string
          updated_at: string
          visitor_name: string
          visitor_phone: string | null
          visitor_vehicle_description: string | null
          visitor_vehicle_plates: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          notes?: string | null
          parking_spot_id: string
          reservation_date: string
          resident_id: string
          start_time: string
          status?: Database["public"]["Enums"]["parking_reservation_status"]
          unit_id: string
          updated_at?: string
          visitor_name: string
          visitor_phone?: string | null
          visitor_vehicle_description?: string | null
          visitor_vehicle_plates?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          parking_spot_id?: string
          reservation_date?: string
          resident_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["parking_reservation_status"]
          unit_id?: string
          updated_at?: string
          visitor_name?: string
          visitor_phone?: string | null
          visitor_vehicle_description?: string | null
          visitor_vehicle_plates?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_reservations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_reservations_parking_spot_id_fkey"
            columns: ["parking_spot_id"]
            isOneToOne: false
            referencedRelation: "parking_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_reservations_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_reservations_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "parking_reservations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "parking_reservations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_spots: {
        Row: {
          area: string | null
          assigned_unit_id: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_covered: boolean
          is_electric_vehicle: boolean
          length_meters: number | null
          level: string | null
          monthly_fee: number | null
          notes: string | null
          section: string | null
          spot_number: string
          spot_type: Database["public"]["Enums"]["parking_spot_type"]
          status: Database["public"]["Enums"]["parking_spot_status"]
          updated_at: string
          width_meters: number | null
        }
        Insert: {
          area?: string | null
          assigned_unit_id?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_covered?: boolean
          is_electric_vehicle?: boolean
          length_meters?: number | null
          level?: string | null
          monthly_fee?: number | null
          notes?: string | null
          section?: string | null
          spot_number: string
          spot_type: Database["public"]["Enums"]["parking_spot_type"]
          status?: Database["public"]["Enums"]["parking_spot_status"]
          updated_at?: string
          width_meters?: number | null
        }
        Update: {
          area?: string | null
          assigned_unit_id?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_covered?: boolean
          is_electric_vehicle?: boolean
          length_meters?: number | null
          level?: string | null
          monthly_fee?: number | null
          notes?: string | null
          section?: string | null
          spot_number?: string
          spot_type?: Database["public"]["Enums"]["parking_spot_type"]
          status?: Database["public"]["Enums"]["parking_spot_status"]
          updated_at?: string
          width_meters?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_spots_assigned_unit_id_fkey"
            columns: ["assigned_unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "parking_spots_assigned_unit_id_fkey"
            columns: ["assigned_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_spots_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_violations: {
        Row: {
          community_id: string
          created_at: string
          description: string
          id: string
          location_description: string | null
          observed_at: string
          parking_spot_id: string | null
          photo_urls: string[] | null
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["parking_violation_status"]
          updated_at: string
          vehicle_description: string | null
          vehicle_id: string | null
          vehicle_plates: string | null
          violation_record_id: string | null
          violation_type: Database["public"]["Enums"]["parking_violation_type"]
        }
        Insert: {
          community_id: string
          created_at?: string
          description: string
          id?: string
          location_description?: string | null
          observed_at?: string
          parking_spot_id?: string | null
          photo_urls?: string[] | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["parking_violation_status"]
          updated_at?: string
          vehicle_description?: string | null
          vehicle_id?: string | null
          vehicle_plates?: string | null
          violation_record_id?: string | null
          violation_type: Database["public"]["Enums"]["parking_violation_type"]
        }
        Update: {
          community_id?: string
          created_at?: string
          description?: string
          id?: string
          location_description?: string | null
          observed_at?: string
          parking_spot_id?: string | null
          photo_urls?: string[] | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["parking_violation_status"]
          updated_at?: string
          vehicle_description?: string | null
          vehicle_id?: string | null
          vehicle_plates?: string | null
          violation_record_id?: string | null
          violation_type?: Database["public"]["Enums"]["parking_violation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "parking_violations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_violations_parking_spot_id_fkey"
            columns: ["parking_spot_id"]
            isOneToOne: false
            referencedRelation: "parking_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_violations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      patrol_checkpoint_logs: {
        Row: {
          checkpoint_id: string
          gps_accuracy_meters: number | null
          gps_lat: number | null
          gps_lng: number | null
          gps_within_tolerance: boolean | null
          id: string
          nfc_serial_scanned: string
          notes: string | null
          patrol_log_id: string
          photo_url: string | null
          scanned_at: string
          sequence_order: number
        }
        Insert: {
          checkpoint_id: string
          gps_accuracy_meters?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          gps_within_tolerance?: boolean | null
          id?: string
          nfc_serial_scanned: string
          notes?: string | null
          patrol_log_id: string
          photo_url?: string | null
          scanned_at?: string
          sequence_order: number
        }
        Update: {
          checkpoint_id?: string
          gps_accuracy_meters?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          gps_within_tolerance?: boolean | null
          id?: string
          nfc_serial_scanned?: string
          notes?: string | null
          patrol_log_id?: string
          photo_url?: string | null
          scanned_at?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "patrol_checkpoint_logs_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "patrol_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrol_checkpoint_logs_patrol_log_id_fkey"
            columns: ["patrol_log_id"]
            isOneToOne: false
            referencedRelation: "patrol_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      patrol_checkpoints: {
        Row: {
          area: string | null
          building: string | null
          community_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          floor: number | null
          id: string
          location_lat: number | null
          location_lng: number | null
          location_tolerance_meters: number | null
          name: string
          nfc_serial: string
          photo_url: string | null
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
        }
        Insert: {
          area?: string | null
          building?: string | null
          community_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          floor?: number | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_tolerance_meters?: number | null
          name: string
          nfc_serial: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Update: {
          area?: string | null
          building?: string | null
          community_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          floor?: number | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_tolerance_meters?: number | null
          name?: string
          nfc_serial?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patrol_checkpoints_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      patrol_logs: {
        Row: {
          abandon_reason: string | null
          checkpoints_total: number
          checkpoints_visited: number
          community_id: string
          completed_at: string | null
          created_at: string
          guard_id: string
          id: string
          observations: string | null
          route_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          abandon_reason?: string | null
          checkpoints_total: number
          checkpoints_visited?: number
          community_id: string
          completed_at?: string | null
          created_at?: string
          guard_id: string
          id?: string
          observations?: string | null
          route_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          abandon_reason?: string | null
          checkpoints_total?: number
          checkpoints_visited?: number
          community_id?: string
          completed_at?: string | null
          created_at?: string
          guard_id?: string
          id?: string
          observations?: string | null
          route_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patrol_logs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrol_logs_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrol_logs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "patrol_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      patrol_routes: {
        Row: {
          applicable_shifts: string[] | null
          checkpoint_sequence: string[]
          community_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          estimated_duration_minutes: number | null
          frequency_minutes: number | null
          id: string
          name: string
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
        }
        Insert: {
          applicable_shifts?: string[] | null
          checkpoint_sequence: string[]
          community_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          frequency_minutes?: number | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Update: {
          applicable_shifts?: string[] | null
          checkpoint_sequence?: string[]
          community_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          frequency_minutes?: number | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patrol_routes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_order: number
          id: string
          is_active: boolean
          is_electronic: boolean
          name: string
          requires_proof: boolean
          updated_at: string
        }
        Insert: {
          code: string
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_electronic?: boolean
          name: string
          requires_proof?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_electronic?: boolean
          name?: string
          requires_proof?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          amount: number
          bank_name: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_filename: string | null
          document_size_bytes: number | null
          document_url: string
          id: string
          payment_date: string
          payment_id: string | null
          proof_type: string
          reference_number: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["approval_status"]
          submitted_at: string
          submitted_by: string
          submitter_notes: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_name?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_filename?: string | null
          document_size_bytes?: number | null
          document_url: string
          id?: string
          payment_date: string
          payment_id?: string | null
          proof_type: string
          reference_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          submitted_by: string
          submitter_notes?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_name?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_filename?: string | null
          document_size_bytes?: number | null
          document_url?: string
          id?: string
          payment_date?: string
          payment_id?: string | null
          proof_type?: string
          reference_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          submitted_by?: string
          submitter_notes?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payment_proofs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          category: string | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          name: string
          resource: string
        }
        Insert: {
          action: string
          category?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          name: string
          resource: string
        }
        Update: {
          action?: string
          category?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          name?: string
          resource?: string
        }
        Relationships: []
      }
      pet_incidents: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          incident_date: string
          incident_type: string
          pet_id: string
          photo_urls: string[] | null
          reported_by: string | null
          resolution_notes: string | null
          resolution_status: Database["public"]["Enums"]["approval_status"]
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
          victim_name: string | null
          victim_resident_id: string | null
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          incident_date: string
          incident_type: string
          pet_id: string
          photo_urls?: string[] | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolution_status?: Database["public"]["Enums"]["approval_status"]
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
          victim_name?: string | null
          victim_resident_id?: string | null
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          incident_date?: string
          incident_type?: string
          pet_id?: string
          photo_urls?: string[] | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolution_status?: Database["public"]["Enums"]["approval_status"]
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
          victim_name?: string | null
          victim_resident_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_incidents_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_incidents_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "pet_incidents_victim_resident_id_fkey"
            columns: ["victim_resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_incidents_victim_resident_id_fkey"
            columns: ["victim_resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      pet_vaccinations: {
        Row: {
          administered_at: string
          batch_number: string | null
          certificate_url: string | null
          clinic_name: string | null
          clinic_phone: string | null
          community_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          pet_id: string
          updated_at: string
          vaccine_brand: string | null
          vaccine_type: string
          veterinarian_name: string | null
        }
        Insert: {
          administered_at: string
          batch_number?: string | null
          certificate_url?: string | null
          clinic_name?: string | null
          clinic_phone?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          pet_id: string
          updated_at?: string
          vaccine_brand?: string | null
          vaccine_type: string
          veterinarian_name?: string | null
        }
        Update: {
          administered_at?: string
          batch_number?: string | null
          certificate_url?: string | null
          clinic_name?: string | null
          clinic_phone?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          pet_id?: string
          updated_at?: string
          vaccine_brand?: string | null
          vaccine_type?: string
          veterinarian_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_vaccinations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          breed: string | null
          color: string | null
          community_id: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          id: string
          is_service_animal: boolean
          microchip_number: string | null
          name: string
          notes: string | null
          photo_url: string | null
          registration_number: string | null
          resident_id: string
          special_needs: string | null
          species: Database["public"]["Enums"]["pet_species"]
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          breed?: string | null
          color?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          id?: string
          is_service_animal?: boolean
          microchip_number?: string | null
          name: string
          notes?: string | null
          photo_url?: string | null
          registration_number?: string | null
          resident_id: string
          special_needs?: string | null
          species: Database["public"]["Enums"]["pet_species"]
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          breed?: string | null
          color?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          id?: string
          is_service_animal?: boolean
          microchip_number?: string | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          registration_number?: string | null
          resident_id?: string
          special_needs?: string | null
          species?: Database["public"]["Enums"]["pet_species"]
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string | null
          community_id: string
          content: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          depth: number
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          is_hidden: boolean
          parent_comment_id: string | null
          post_id: string
          root_comment_id: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          community_id: string
          content: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          depth?: number
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          parent_comment_id?: string | null
          post_id: string
          root_comment_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          community_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          depth?: number
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          parent_comment_id?: string | null
          post_id?: string
          root_comment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "post_comments_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          community_id: string
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          resident_id: string
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          post_id: string
          reaction_type: string
          resident_id: string
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          channel_id: string
          comment_count: number
          community_id: string
          content: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          is_hidden: boolean
          is_locked: boolean
          is_pinned: boolean
          media_urls: string[] | null
          poll_ends_at: string | null
          poll_options: Json | null
          poll_results: Json | null
          post_type: Database["public"]["Enums"]["post_type"]
          reaction_counts: Json
          title: string | null
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id?: string | null
          channel_id: string
          comment_count?: number
          community_id: string
          content: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          is_locked?: boolean
          is_pinned?: boolean
          media_urls?: string[] | null
          poll_ends_at?: string | null
          poll_options?: Json | null
          poll_results?: Json | null
          post_type?: Database["public"]["Enums"]["post_type"]
          reaction_counts?: Json
          title?: string | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string | null
          channel_id?: string
          comment_count?: number
          community_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          is_locked?: boolean
          is_pinned?: boolean
          media_urls?: string[] | null
          poll_ends_at?: string | null
          poll_options?: Json | null
          poll_results?: Json | null
          post_type?: Database["public"]["Enums"]["post_type"]
          reaction_counts?: Json
          title?: string | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_schedules: {
        Row: {
          asset_id: string | null
          auto_assign_to: string | null
          category_id: string
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          description_template: string | null
          dtstart: string
          generate_days_ahead: number
          id: string
          is_active: boolean
          last_generated_at: string | null
          name: string
          next_occurrence_at: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          rrule: string
          title_template: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          auto_assign_to?: string | null
          category_id: string
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          description_template?: string | null
          dtstart: string
          generate_days_ahead?: number
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          name: string
          next_occurrence_at?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          rrule: string
          title_template: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          auto_assign_to?: string | null
          category_id?: string
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          description_template?: string | null
          dtstart?: string
          generate_days_ahead?: number
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          name?: string
          next_occurrence_at?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          rrule?: string
          title_template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_schedules_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_schedules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_schedules_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_access_schedules: {
        Row: {
          allowed_days: number[]
          community_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          end_time: string
          id: string
          is_active: boolean
          name: string
          provider_id: string
          start_time: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_days?: number[]
          community_id: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          name: string
          provider_id: string
          start_time?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_days?: number[]
          community_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          provider_id?: string
          start_time?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_access_schedules_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_access_schedules_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_documents: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          document_name: string
          document_number: string | null
          document_type: string
          expires_at: string | null
          expiry_alert_sent_14d: boolean
          expiry_alert_sent_30d: boolean
          expiry_alert_sent_7d: boolean
          file_name: string
          id: string
          issued_at: string | null
          issuing_authority: string | null
          provider_id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          document_name: string
          document_number?: string | null
          document_type: string
          expires_at?: string | null
          expiry_alert_sent_14d?: boolean
          expiry_alert_sent_30d?: boolean
          expiry_alert_sent_7d?: boolean
          file_name: string
          id?: string
          issued_at?: string | null
          issuing_authority?: string | null
          provider_id: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          document_name?: string
          document_number?: string | null
          document_type?: string
          expires_at?: string | null
          expiry_alert_sent_14d?: boolean
          expiry_alert_sent_30d?: boolean
          expiry_alert_sent_7d?: boolean
          file_name?: string
          id?: string
          issued_at?: string | null
          issuing_authority?: string | null
          provider_id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_documents_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_documents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_personnel: {
        Row: {
          allowed_access_points: string[] | null
          authorized_from: string | null
          authorized_until: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          first_name: string
          full_name: string | null
          id: string
          ine_number: string | null
          is_authorized: boolean
          maternal_surname: string | null
          notes: string | null
          paternal_surname: string
          phone: string | null
          photo_url: string | null
          provider_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_access_points?: string[] | null
          authorized_from?: string | null
          authorized_until?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          first_name: string
          full_name?: string | null
          id?: string
          ine_number?: string | null
          is_authorized?: boolean
          maternal_surname?: string | null
          notes?: string | null
          paternal_surname: string
          phone?: string | null
          photo_url?: string | null
          provider_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_access_points?: string[] | null
          authorized_from?: string | null
          authorized_until?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          first_name?: string
          full_name?: string | null
          id?: string
          ine_number?: string | null
          is_authorized?: boolean
          maternal_surname?: string | null
          notes?: string | null
          paternal_surname?: string
          phone?: string | null
          photo_url?: string | null
          provider_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_personnel_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_personnel_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_work_orders: {
        Row: {
          actual_cost: number | null
          admin_notes: string | null
          assigned_personnel_ids: string[] | null
          category: string | null
          community_id: string
          completed_by: string | null
          completed_date: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string
          estimated_cost: number | null
          id: string
          location_description: string | null
          provider_id: string
          provider_notes: string | null
          rating: number | null
          rating_notes: string | null
          requested_date: string | null
          scheduled_date: string | null
          scheduled_time_end: string | null
          scheduled_time_start: string | null
          status: string
          ticket_id: string | null
          title: string
          unit_id: string | null
          updated_at: string
          updated_by: string | null
          work_order_number: string
        }
        Insert: {
          actual_cost?: number | null
          admin_notes?: string | null
          assigned_personnel_ids?: string[] | null
          category?: string | null
          community_id: string
          completed_by?: string | null
          completed_date?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description: string
          estimated_cost?: number | null
          id?: string
          location_description?: string | null
          provider_id: string
          provider_notes?: string | null
          rating?: number | null
          rating_notes?: string | null
          requested_date?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          status?: string
          ticket_id?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
          work_order_number: string
        }
        Update: {
          actual_cost?: number | null
          admin_notes?: string | null
          assigned_personnel_ids?: string[] | null
          category?: string | null
          community_id?: string
          completed_by?: string | null
          completed_date?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          estimated_cost?: number | null
          id?: string
          location_description?: string | null
          provider_id?: string
          provider_notes?: string | null
          rating?: number | null
          rating_notes?: string | null
          requested_date?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          status?: string
          ticket_id?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
          work_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_work_orders_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_work_orders_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_work_orders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "provider_work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          average_rating: number | null
          community_id: string
          company_name: string
          contact_email: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          legal_name: string | null
          notes: string | null
          rfc: string | null
          specialties: string[]
          status: Database["public"]["Enums"]["provider_status"]
          total_work_orders: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          average_rating?: number | null
          community_id: string
          company_name: string
          contact_email?: string | null
          contact_name: string
          contact_phone: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          legal_name?: string | null
          notes?: string | null
          rfc?: string | null
          specialties: string[]
          status?: Database["public"]["Enums"]["provider_status"]
          total_work_orders?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          average_rating?: number | null
          community_id?: string
          company_name?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          legal_name?: string | null
          notes?: string | null
          rfc?: string | null
          specialties?: string[]
          status?: Database["public"]["Enums"]["provider_status"]
          total_work_orders?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          id: string
          invitation_id: string | null
          is_single_use: boolean
          payload: string
          resident_id: string | null
          scanned_at: string | null
          scanned_at_access_point: string | null
          scanned_by: string | null
          signature: string
          status: Database["public"]["Enums"]["qr_status"]
          valid_from: string
          valid_until: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invitation_id?: string | null
          is_single_use?: boolean
          payload: string
          resident_id?: string | null
          scanned_at?: string | null
          scanned_at_access_point?: string | null
          scanned_by?: string | null
          signature: string
          status?: Database["public"]["Enums"]["qr_status"]
          valid_from?: string
          valid_until: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invitation_id?: string | null
          is_single_use?: boolean
          payload?: string
          resident_id?: string | null
          scanned_at?: string | null
          scanned_at_access_point?: string | null
          scanned_by?: string | null
          signature?: string
          status?: Database["public"]["Enums"]["qr_status"]
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "qr_codes_scanned_at_access_point_fkey"
            columns: ["scanned_at_access_point"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_responses: {
        Row: {
          category: string | null
          community_id: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          community_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          community_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_responses_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_rules: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          criteria: Json
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          criteria: Json
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          criteria?: Json
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_rules_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      regulation_signatures: {
        Row: {
          browser: string | null
          community_id: string
          consent_checkbox_id: string | null
          consent_text: string
          created_at: string
          device_id: string | null
          device_model: string | null
          device_type: string | null
          document_id: string
          document_version_id: string
          id: string
          ip_address: unknown
          latitude: number | null
          location_accuracy_meters: number | null
          longitude: number | null
          os: string | null
          resident_id: string
          screen_resolution: string | null
          signature_data: string | null
          signature_hash: string
          signature_type: string
          signed_at: string
          unit_id: string | null
          user_agent: string
        }
        Insert: {
          browser?: string | null
          community_id: string
          consent_checkbox_id?: string | null
          consent_text: string
          created_at?: string
          device_id?: string | null
          device_model?: string | null
          device_type?: string | null
          document_id: string
          document_version_id: string
          id?: string
          ip_address: unknown
          latitude?: number | null
          location_accuracy_meters?: number | null
          longitude?: number | null
          os?: string | null
          resident_id: string
          screen_resolution?: string | null
          signature_data?: string | null
          signature_hash: string
          signature_type?: string
          signed_at?: string
          unit_id?: string | null
          user_agent: string
        }
        Update: {
          browser?: string | null
          community_id?: string
          consent_checkbox_id?: string | null
          consent_text?: string
          created_at?: string
          device_id?: string | null
          device_model?: string | null
          device_type?: string | null
          document_id?: string
          document_version_id?: string
          id?: string
          ip_address?: unknown
          latitude?: number | null
          location_accuracy_meters?: number | null
          longitude?: number | null
          os?: string | null
          resident_id?: string
          screen_resolution?: string | null
          signature_data?: string | null
          signature_hash?: string
          signature_type?: string
          signed_at?: string
          unit_id?: string | null
          user_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulation_signatures_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulation_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulation_signatures_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulation_signatures_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulation_signatures_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "regulation_signatures_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "regulation_signatures_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_fees: {
        Row: {
          amount: number
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          fee_type: Database["public"]["Enums"]["fee_type_reservation"]
          id: string
          notes: string | null
          paid_at: string | null
          refund_transaction_id: string | null
          refunded_at: string | null
          reservation_id: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fee_type: Database["public"]["Enums"]["fee_type_reservation"]
          id?: string
          notes?: string | null
          paid_at?: string | null
          refund_transaction_id?: string | null
          refunded_at?: string | null
          reservation_id: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fee_type?: Database["public"]["Enums"]["fee_type_reservation"]
          id?: string
          notes?: string | null
          paid_at?: string | null
          refund_transaction_id?: string | null
          refunded_at?: string | null
          reservation_id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_fees_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_fees_refund_transaction_id_fkey"
            columns: ["refund_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_fees_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_fees_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_waitlist: {
        Row: {
          amenity_id: string
          community_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          position: number
          promoted_at: string | null
          promoted_to_reservation_id: string | null
          requested_date: string
          requested_range: unknown
          resident_id: string
          status: Database["public"]["Enums"]["waitlist_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          amenity_id: string
          community_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          position: number
          promoted_at?: string | null
          promoted_to_reservation_id?: string | null
          requested_date: string
          requested_range: unknown
          resident_id: string
          status?: Database["public"]["Enums"]["waitlist_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          amenity_id?: string
          community_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          position?: number
          promoted_at?: string | null
          promoted_to_reservation_id?: string | null
          requested_date?: string
          requested_range?: unknown
          resident_id?: string
          status?: Database["public"]["Enums"]["waitlist_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_waitlist_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_waitlist_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_waitlist_promoted_to_reservation_id_fkey"
            columns: ["promoted_to_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_waitlist_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_waitlist_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "reservation_waitlist_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "reservation_waitlist_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          amenity_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          community_id: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          no_show_at: string | null
          notes: string | null
          reserved_range: unknown
          resident_id: string
          status: Database["public"]["Enums"]["reservation_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          amenity_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          community_id: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          no_show_at?: string | null
          notes?: string | null
          reserved_range: unknown
          resident_id: string
          status?: Database["public"]["Enums"]["reservation_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          amenity_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          community_id?: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          no_show_at?: string | null
          notes?: string | null
          reserved_range?: unknown
          resident_id?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "reservations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "reservations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_documents: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          expires_at: string | null
          file_name: string
          file_size_bytes: number | null
          id: string
          issued_at: string | null
          mime_type: string | null
          name: string
          rejection_reason: string | null
          resident_id: string
          storage_bucket: string
          storage_path: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["approval_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          expires_at?: string | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          issued_at?: string | null
          mime_type?: string | null
          name: string
          rejection_reason?: string | null
          resident_id: string
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["approval_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          expires_at?: string | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          issued_at?: string | null
          mime_type?: string | null
          name?: string
          rejection_reason?: string | null
          resident_id?: string
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["approval_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resident_documents_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_documents_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_documents_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      residents: {
        Row: {
          activated_at: string | null
          community_id: string
          created_at: string
          curp: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_name: string
          full_name: string | null
          gender: string | null
          id: string
          ine_back_url: string | null
          ine_cic: string | null
          ine_front_url: string | null
          ine_number: string | null
          ine_ocr: string | null
          ine_verified: boolean | null
          invited_at: string | null
          kyc_status: Database["public"]["Enums"]["approval_status"]
          kyc_verified_at: string | null
          kyc_verified_by: string | null
          locale: string | null
          maternal_surname: string | null
          middle_name: string | null
          notification_preferences: Json | null
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          paternal_surname: string
          phone: string | null
          phone_secondary: string | null
          photo_url: string | null
          proof_of_address_url: string | null
          registered_at: string | null
          updated_at: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          activated_at?: string | null
          community_id: string
          created_at?: string
          curp?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name: string
          full_name?: string | null
          gender?: string | null
          id?: string
          ine_back_url?: string | null
          ine_cic?: string | null
          ine_front_url?: string | null
          ine_number?: string | null
          ine_ocr?: string | null
          ine_verified?: boolean | null
          invited_at?: string | null
          kyc_status?: Database["public"]["Enums"]["approval_status"]
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          locale?: string | null
          maternal_surname?: string | null
          middle_name?: string | null
          notification_preferences?: Json | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          paternal_surname: string
          phone?: string | null
          phone_secondary?: string | null
          photo_url?: string | null
          proof_of_address_url?: string | null
          registered_at?: string | null
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          activated_at?: string | null
          community_id?: string
          created_at?: string
          curp?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          ine_back_url?: string | null
          ine_cic?: string | null
          ine_front_url?: string | null
          ine_number?: string | null
          ine_ocr?: string | null
          ine_verified?: boolean | null
          invited_at?: string | null
          kyc_status?: Database["public"]["Enums"]["approval_status"]
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          locale?: string | null
          maternal_surname?: string | null
          middle_name?: string | null
          notification_preferences?: Json | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          paternal_surname?: string
          phone?: string | null
          phone_secondary?: string | null
          photo_url?: string | null
          proof_of_address_url?: string | null
          registered_at?: string | null
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          conditions: Json | null
          granted_at: string
          granted_by: string | null
          id: string
          permission_id: string
          role_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          conditions?: Json | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_id: string
          role_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          conditions?: Json | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_id?: string
          role_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          community_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          is_default: boolean
          is_system_role: boolean
          name: string
          parent_role_id: string | null
          updated_at: string
        }
        Insert: {
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_system_role?: boolean
          name: string
          parent_role_id?: string | null
          updated_at?: string
        }
        Update: {
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_system_role?: boolean
          name?: string
          parent_role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_parent_role_id_fkey"
            columns: ["parent_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          community_id: string | null
          description: string
          entity_id: string | null
          entity_type: string | null
          event_type: Database["public"]["Enums"]["security_event_type"]
          id: string
          ip_address: unknown
          logged_at: string
          metadata: Json | null
          session_id: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          community_id?: string | null
          description: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: unknown
          logged_at?: string
          metadata?: Json | null
          session_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          community_id?: string | null
          description?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: unknown
          logged_at?: string
          metadata?: Json | null
          session_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_notifications: {
        Row: {
          action_at: string | null
          action_taken: string | null
          body: string
          community_id: string
          created_at: string
          delivered_at: string | null
          delivery_channel: string | null
          expires_at: string | null
          id: string
          notification_type: Database["public"]["Enums"]["notification_type_service"]
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          resident_id: string
          sent_at: string
          title: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          action_at?: string | null
          action_taken?: string | null
          body: string
          community_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string | null
          expires_at?: string | null
          id?: string
          notification_type: Database["public"]["Enums"]["notification_type_service"]
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resident_id: string
          sent_at?: string
          title: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          action_at?: string | null
          action_taken?: string | null
          body?: string
          community_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string | null
          expires_at?: string | null
          id?: string
          notification_type?: Database["public"]["Enums"]["notification_type_service"]
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resident_id?: string
          sent_at?: string
          title?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_notifications_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_notifications_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_notifications_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "service_notifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "service_notifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_assignments: {
        Row: {
          access_point_id: string
          community_id: string
          created_at: string
          deleted_at: string | null
          effective_from: string
          effective_until: string | null
          guard_id: string
          id: string
          notes: string | null
          shift_id: string
          status: Database["public"]["Enums"]["general_status"]
          updated_at: string
        }
        Insert: {
          access_point_id: string
          community_id: string
          created_at?: string
          deleted_at?: string | null
          effective_from: string
          effective_until?: string | null
          guard_id: string
          id?: string
          notes?: string | null
          shift_id: string
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Update: {
          access_point_id?: string
          community_id?: string
          created_at?: string
          deleted_at?: string | null
          effective_from?: string
          effective_until?: string | null
          guard_id?: string
          id?: string
          notes?: string | null
          shift_id?: string
          status?: Database["public"]["Enums"]["general_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "guard_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_handovers: {
        Row: {
          access_point_id: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          community_id: string
          created_at: string
          guard_id: string
          id: string
          notes: string
          pending_items: Json | null
          priority: string
          shift_ended_at: string | null
          shift_id: string | null
          shift_started_at: string | null
          updated_at: string
        }
        Insert: {
          access_point_id?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          community_id: string
          created_at?: string
          guard_id: string
          id?: string
          notes: string
          pending_items?: Json | null
          priority?: string
          shift_ended_at?: string | null
          shift_id?: string | null
          shift_started_at?: string | null
          updated_at?: string
        }
        Update: {
          access_point_id?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          community_id?: string
          created_at?: string
          guard_id?: string
          id?: string
          notes?: string
          pending_items?: Json | null
          priority?: string
          shift_ended_at?: string | null
          shift_id?: string | null
          shift_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_handovers_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_handovers_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_handovers_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_handovers_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_handovers_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "guard_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_definitions: {
        Row: {
          business_hours_only: boolean
          category_id: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          escalate_on_breach: boolean
          escalate_to: string | null
          id: string
          is_active: boolean
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes: number
          response_minutes: number
          updated_at: string
        }
        Insert: {
          business_hours_only?: boolean
          category_id?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          escalate_on_breach?: boolean
          escalate_to?: string | null
          id?: string
          is_active?: boolean
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes: number
          response_minutes: number
          updated_at?: string
        }
        Update: {
          business_hours_only?: boolean
          category_id?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          escalate_on_breach?: boolean
          escalate_to?: string | null
          id?: string
          is_active?: boolean
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes?: number
          response_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_definitions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_definitions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          assigned_to: string
          id: string
          notes: string | null
          ticket_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          assigned_to: string
          id?: string
          notes?: string | null
          ticket_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          assigned_to?: string
          id?: string
          notes?: string | null
          ticket_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          color: string | null
          community_id: string
          created_at: string
          created_by: string | null
          default_assignee_id: string | null
          default_resolution_hours: number | null
          default_response_hours: number | null
          deleted_at: string | null
          description: string | null
          escalation_contact_id: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_category_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          default_assignee_id?: string | null
          default_resolution_hours?: number | null
          default_response_hours?: number | null
          deleted_at?: string | null
          description?: string | null
          escalation_contact_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_category_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          default_assignee_id?: string | null
          default_resolution_hours?: number | null
          default_response_hours?: number | null
          deleted_at?: string | null
          description?: string | null
          escalation_contact_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_category_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_categories_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string
          author_role: string
          content: string | null
          created_at: string
          id: string
          is_internal: boolean
          is_system: boolean
          photo_urls: string[] | null
          status_from: Database["public"]["Enums"]["ticket_status"] | null
          status_to: Database["public"]["Enums"]["ticket_status"] | null
          system_action: string | null
          system_data: Json | null
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_role: string
          content?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          is_system?: boolean
          photo_urls?: string[] | null
          status_from?: Database["public"]["Enums"]["ticket_status"] | null
          status_to?: Database["public"]["Enums"]["ticket_status"] | null
          system_action?: string | null
          system_data?: Json | null
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_role?: string
          content?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          is_system?: boolean
          photo_urls?: string[] | null
          status_from?: Database["public"]["Enums"]["ticket_status"] | null
          status_to?: Database["public"]["Enums"]["ticket_status"] | null
          system_action?: string | null
          system_data?: Json | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_escalations: {
        Row: {
          action_taken: string
          id: string
          new_assignee: string | null
          new_priority: Database["public"]["Enums"]["ticket_priority"] | null
          notes: string | null
          previous_assignee: string | null
          previous_priority:
            | Database["public"]["Enums"]["ticket_priority"]
            | null
          rule_id: string | null
          ticket_id: string
          triggered_at: string
        }
        Insert: {
          action_taken: string
          id?: string
          new_assignee?: string | null
          new_priority?: Database["public"]["Enums"]["ticket_priority"] | null
          notes?: string | null
          previous_assignee?: string | null
          previous_priority?:
            | Database["public"]["Enums"]["ticket_priority"]
            | null
          rule_id?: string | null
          ticket_id: string
          triggered_at?: string
        }
        Update: {
          action_taken?: string
          id?: string
          new_assignee?: string | null
          new_priority?: Database["public"]["Enums"]["ticket_priority"] | null
          notes?: string | null
          previous_assignee?: string | null
          previous_priority?:
            | Database["public"]["Enums"]["ticket_priority"]
            | null
          rule_id?: string | null
          ticket_id?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_escalations_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "escalation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_escalations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asset_id: string | null
          assigned_at: string | null
          assigned_to: string | null
          category_id: string
          community_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json
          deleted_at: string | null
          description: string
          first_responded_at: string | null
          id: string
          location: string | null
          preventive_schedule_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          reported_by: string
          resolution_breached: boolean
          resolution_due_at: string | null
          resolved_at: string | null
          response_breached: boolean
          response_due_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          status_changed_at: string
          tags: string[] | null
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          category_id: string
          community_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deleted_at?: string | null
          description: string
          first_responded_at?: string | null
          id?: string
          location?: string | null
          preventive_schedule_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reported_by: string
          resolution_breached?: boolean
          resolution_due_at?: string | null
          resolved_at?: string | null
          response_breached?: boolean
          response_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          status_changed_at?: string
          tags?: string[] | null
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          category_id?: string
          community_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deleted_at?: string | null
          description?: string
          first_responded_at?: string | null
          id?: string
          location?: string | null
          preventive_schedule_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reported_by?: string
          resolution_breached?: boolean
          resolution_due_at?: string | null
          resolved_at?: string | null
          response_breached?: boolean
          response_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          status_changed_at?: string
          tags?: string[] | null
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_preventive_schedule_id_fkey"
            columns: ["preventive_schedule_id"]
            isOneToOne: false
            referencedRelation: "preventive_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "tickets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "tickets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          community_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string
          effective_date: string
          id: string
          posted_at: string | null
          posted_by: string | null
          reference_number: string
          resident_id: string | null
          reversed_by_transaction_id: string | null
          reverses_transaction_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          community_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description: string
          effective_date?: string
          id?: string
          posted_at?: string | null
          posted_by?: string | null
          reference_number: string
          resident_id?: string | null
          reversed_by_transaction_id?: string | null
          reverses_transaction_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          community_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          effective_date?: string
          id?: string
          posted_at?: string | null
          posted_by?: string | null
          reference_number?: string
          resident_id?: string | null
          reversed_by_transaction_id?: string | null
          reverses_transaction_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "transactions_reversed_by_transaction_id_fkey"
            columns: ["reversed_by_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reverses_transaction_id_fkey"
            columns: ["reverses_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address_line: string | null
          area_m2: number | null
          building: string | null
          coefficient: number
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          floor_number: number | null
          id: string
          parking_spaces: number
          status: Database["public"]["Enums"]["general_status"]
          unit_number: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          area_m2?: number | null
          building?: string | null
          coefficient?: number
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          floor_number?: number | null
          id?: string
          parking_spaces?: number
          status?: Database["public"]["Enums"]["general_status"]
          unit_number: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          area_m2?: number | null
          building?: string | null
          coefficient?: number
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          floor_number?: number | null
          id?: string
          parking_spaces?: number
          status?: Database["public"]["Enums"]["general_status"]
          unit_number?: string
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          community_id: string
          id: string
          is_active: boolean
          role_id: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          community_id: string
          id?: string
          is_active?: boolean
          role_id: string
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          community_id?: string
          id?: string
          is_active?: boolean
          role_id?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          app_version: string | null
          auth_session_id: string | null
          browser: string | null
          browser_version: string | null
          city: string | null
          country: string | null
          created_at: string
          device_fingerprint: string | null
          device_id: string | null
          device_model: string | null
          device_type: string | null
          expires_at: string | null
          id: string
          ip_address: unknown
          is_suspicious: boolean
          last_active_at: string
          latitude: number | null
          longitude: number | null
          os: string | null
          os_version: string | null
          region: string | null
          screen_resolution: string | null
          suspicious_reason: string | null
          terminated_at: string | null
          termination_reason: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          auth_session_id?: string | null
          browser?: string | null
          browser_version?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string | null
          device_id?: string | null
          device_model?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address: unknown
          is_suspicious?: boolean
          last_active_at?: string
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          os_version?: string | null
          region?: string | null
          screen_resolution?: string | null
          suspicious_reason?: string | null
          terminated_at?: string | null
          termination_reason?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          auth_session_id?: string | null
          browser?: string | null
          browser_version?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string | null
          device_id?: string | null
          device_model?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_suspicious?: boolean
          last_active_at?: string
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          os_version?: string | null
          region?: string | null
          screen_resolution?: string | null
          suspicious_reason?: string | null
          terminated_at?: string | null
          termination_reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          access_enabled: boolean
          color: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          last_lpr_detection: string | null
          lpr_confidence: number | null
          make: string | null
          model: string | null
          notes: string | null
          plate_image_url: string | null
          plate_normalized: string
          plate_number: string
          plate_state: string
          resident_id: string
          status: Database["public"]["Enums"]["general_status"]
          sticker_issued_at: string | null
          sticker_number: string | null
          updated_at: string
          vehicle_image_url: string | null
          year: number | null
        }
        Insert: {
          access_enabled?: boolean
          color?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          last_lpr_detection?: string | null
          lpr_confidence?: number | null
          make?: string | null
          model?: string | null
          notes?: string | null
          plate_image_url?: string | null
          plate_normalized?: string
          plate_number: string
          plate_state: string
          resident_id: string
          status?: Database["public"]["Enums"]["general_status"]
          sticker_issued_at?: string | null
          sticker_number?: string | null
          updated_at?: string
          vehicle_image_url?: string | null
          year?: number | null
        }
        Update: {
          access_enabled?: boolean
          color?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          last_lpr_detection?: string | null
          lpr_confidence?: number | null
          make?: string | null
          model?: string | null
          notes?: string | null
          plate_image_url?: string | null
          plate_normalized?: string
          plate_number?: string
          plate_state?: string
          resident_id?: string
          status?: Database["public"]["Enums"]["general_status"]
          sticker_issued_at?: string | null
          sticker_number?: string | null
          updated_at?: string
          vehicle_image_url?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      violation_appeals: {
        Row: {
          appeal_reason: string
          appealed_by: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          deleted_at: string | null
          fine_reduced_to: number | null
          hearing_date: string | null
          hearing_notes: string | null
          id: string
          sanction_id: string | null
          sanction_modified_to: string | null
          status: string
          supporting_documents: string[] | null
          updated_at: string
          updated_by: string | null
          violation_id: string
        }
        Insert: {
          appeal_reason: string
          appealed_by: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          deleted_at?: string | null
          fine_reduced_to?: number | null
          hearing_date?: string | null
          hearing_notes?: string | null
          id?: string
          sanction_id?: string | null
          sanction_modified_to?: string | null
          status?: string
          supporting_documents?: string[] | null
          updated_at?: string
          updated_by?: string | null
          violation_id: string
        }
        Update: {
          appeal_reason?: string
          appealed_by?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          deleted_at?: string | null
          fine_reduced_to?: number | null
          hearing_date?: string | null
          hearing_notes?: string | null
          id?: string
          sanction_id?: string | null
          sanction_modified_to?: string | null
          status?: string
          supporting_documents?: string[] | null
          updated_at?: string
          updated_by?: string | null
          violation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "violation_appeals_appealed_by_fkey"
            columns: ["appealed_by"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violation_appeals_appealed_by_fkey"
            columns: ["appealed_by"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "violation_appeals_sanction_id_fkey"
            columns: ["sanction_id"]
            isOneToOne: false
            referencedRelation: "violation_sanctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violation_appeals_violation_id_fkey"
            columns: ["violation_id"]
            isOneToOne: false
            referencedRelation: "violations"
            referencedColumns: ["id"]
          },
        ]
      }
      violation_sanctions: {
        Row: {
          created_at: string
          description: string
          fine_amount: number | null
          id: string
          issued_at: string
          issued_by: string | null
          notification_method: string | null
          notified_at: string | null
          sanction_type: Database["public"]["Enums"]["sanction_type"]
          status: string
          suspended_amenities: string[] | null
          suspension_end: string | null
          suspension_start: string | null
          transaction_id: string | null
          violation_id: string
        }
        Insert: {
          created_at?: string
          description: string
          fine_amount?: number | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          notification_method?: string | null
          notified_at?: string | null
          sanction_type: Database["public"]["Enums"]["sanction_type"]
          status?: string
          suspended_amenities?: string[] | null
          suspension_end?: string | null
          suspension_start?: string | null
          transaction_id?: string | null
          violation_id: string
        }
        Update: {
          created_at?: string
          description?: string
          fine_amount?: number | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          notification_method?: string | null
          notified_at?: string | null
          sanction_type?: Database["public"]["Enums"]["sanction_type"]
          status?: string
          suspended_amenities?: string[] | null
          suspension_end?: string | null
          suspension_start?: string | null
          transaction_id?: string | null
          violation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "violation_sanctions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violation_sanctions_violation_id_fkey"
            columns: ["violation_id"]
            isOneToOne: false
            referencedRelation: "violations"
            referencedColumns: ["id"]
          },
        ]
      }
      violation_types: {
        Row: {
          can_restrict_access: boolean
          can_suspend_amenities: boolean
          category: string
          community_id: string
          created_at: string
          created_by: string | null
          default_severity: Database["public"]["Enums"]["violation_severity"]
          deleted_at: string | null
          description: string
          escalate_after_count: number
          first_offense_fine: number | null
          id: string
          is_active: boolean
          name: string
          second_offense_fine: number | null
          third_offense_fine: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_restrict_access?: boolean
          can_suspend_amenities?: boolean
          category: string
          community_id: string
          created_at?: string
          created_by?: string | null
          default_severity?: Database["public"]["Enums"]["violation_severity"]
          deleted_at?: string | null
          description: string
          escalate_after_count?: number
          first_offense_fine?: number | null
          id?: string
          is_active?: boolean
          name: string
          second_offense_fine?: number | null
          third_offense_fine?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_restrict_access?: boolean
          can_suspend_amenities?: boolean
          category?: string
          community_id?: string
          created_at?: string
          created_by?: string | null
          default_severity?: Database["public"]["Enums"]["violation_severity"]
          deleted_at?: string | null
          description?: string
          escalate_after_count?: number
          first_offense_fine?: number | null
          id?: string
          is_active?: boolean
          name?: string
          second_offense_fine?: number | null
          third_offense_fine?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "violation_types_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      violations: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          id: string
          location: string | null
          occurred_at: string
          offense_number: number
          photo_urls: string[] | null
          previous_violation_id: string | null
          reported_at: string
          reported_by: string | null
          resident_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["violation_severity"]
          status: string
          unit_id: string
          updated_at: string
          updated_by: string | null
          video_urls: string[] | null
          violation_number: string
          violation_type_id: string
          witness_names: string[] | null
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description: string
          id?: string
          location?: string | null
          occurred_at: string
          offense_number?: number
          photo_urls?: string[] | null
          previous_violation_id?: string | null
          reported_at?: string
          reported_by?: string | null
          resident_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: Database["public"]["Enums"]["violation_severity"]
          status?: string
          unit_id: string
          updated_at?: string
          updated_by?: string | null
          video_urls?: string[] | null
          violation_number: string
          violation_type_id: string
          witness_names?: string[] | null
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          id?: string
          location?: string | null
          occurred_at?: string
          offense_number?: number
          photo_urls?: string[] | null
          previous_violation_id?: string | null
          reported_at?: string
          reported_by?: string | null
          resident_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["violation_severity"]
          status?: string
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
          video_urls?: string[] | null
          violation_number?: string
          violation_type_id?: string
          witness_names?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "violations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_previous_violation_id_fkey"
            columns: ["previous_violation_id"]
            isOneToOne: false
            referencedRelation: "violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "violations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "violations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_violation_type_id_fkey"
            columns: ["violation_type_id"]
            isOneToOne: false
            referencedRelation: "violation_types"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt_count: number
          community_id: string
          created_at: string
          delivered_at: string | null
          endpoint_id: string
          event_id: string
          event_type: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          last_response_body: string | null
          last_response_code: number | null
          max_attempts: number
          next_attempt_at: string | null
          payload: Json
          signature: string | null
          status: Database["public"]["Enums"]["webhook_status"]
        }
        Insert: {
          attempt_count?: number
          community_id: string
          created_at?: string
          delivered_at?: string | null
          endpoint_id: string
          event_id: string
          event_type: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_response_body?: string | null
          last_response_code?: number | null
          max_attempts?: number
          next_attempt_at?: string | null
          payload: Json
          signature?: string | null
          status?: Database["public"]["Enums"]["webhook_status"]
        }
        Update: {
          attempt_count?: number
          community_id?: string
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string
          event_id?: string
          event_type?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_response_body?: string | null
          last_response_code?: number | null
          max_attempts?: number
          next_attempt_at?: string | null
          payload?: Json
          signature?: string | null
          status?: Database["public"]["Enums"]["webhook_status"]
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_delivery_stats"
            referencedColumns: ["endpoint_id"]
          },
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          auto_disabled_at: string | null
          community_id: string
          consecutive_failures: number
          created_at: string
          created_by: string | null
          custom_headers: Json | null
          deleted_at: string | null
          event_types: string[]
          id: string
          is_active: boolean
          last_failure_at: string | null
          last_failure_reason: string | null
          last_success_at: string | null
          max_retries: number
          name: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          auto_disabled_at?: string | null
          community_id: string
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          custom_headers?: Json | null
          deleted_at?: string | null
          event_types: string[]
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_success_at?: string | null
          max_retries?: number
          name: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          auto_disabled_at?: string | null
          community_id?: string
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          custom_headers?: Json | null
          deleted_at?: string | null
          event_types?: string[]
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_success_at?: string | null
          max_retries?: number
          name?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      access_device_inventory: {
        Row: {
          assigned: number | null
          available: number | null
          community_id: string | null
          damaged: number | null
          deactivated: number | null
          deposit_amount: number | null
          device_type: Database["public"]["Enums"]["device_type"] | null
          device_type_id: string | null
          device_type_name: string | null
          lost: number | null
          replacement_fee: number | null
          retired: number | null
          total_devices: number | null
        }
        Relationships: [
          {
            foreignKeyName: "access_device_types_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      account_ledger: {
        Row: {
          account_id: string | null
          account_name: string | null
          account_number: string | null
          amount: number | null
          balance_after: number | null
          category: Database["public"]["Enums"]["account_category"] | null
          community_id: string | null
          created_at: string | null
          effective_date: string | null
          entry_sequence: number | null
          id: string | null
          reference_number: string | null
          transaction_description: string | null
          transaction_id: string | null
          transaction_status:
            | Database["public"]["Enums"]["transaction_status"]
            | null
          transaction_type:
            | Database["public"]["Enums"]["transaction_type"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      assembly_attendance_list: {
        Row: {
          arrived_at_convocatoria: number | null
          assembly_id: string | null
          assembly_number: string | null
          assembly_title: string | null
          attendance_status: string | null
          attendee_type: Database["public"]["Enums"]["attendance_type"] | null
          checked_in_at: string | null
          checked_out_at: string | null
          coefficient: number | null
          display_name: string | null
          external_name: string | null
          id: string | null
          is_proxy: boolean | null
          proxy_grantor_id: string | null
          proxy_grantor_name: string | null
          resident_id: string | null
          resident_name: string | null
          unit_id: string | null
          unit_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembly_attendance_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_attendance_proxy_grantor_id_fkey"
            columns: ["proxy_grantor_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_attendance_proxy_grantor_id_fkey"
            columns: ["proxy_grantor_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "assembly_attendance_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_attendance_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "security_medical_summary"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "assembly_attendance_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "assembly_attendance_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_job_status: {
        Row: {
          active: boolean | null
          command: string | null
          database: string | null
          jobid: number | null
          jobname: string | null
          last_message: string | null
          last_run: string | null
          last_status: string | null
          nodename: string | null
          nodeport: number | null
          schedule: string | null
          username: string | null
        }
        Insert: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          last_message?: never
          last_run?: never
          last_status?: never
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          last_message?: never
          last_run?: never
          last_status?: never
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Relationships: []
      }
      provider_documents_expiring: {
        Row: {
          community_id: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          days_until_expiry: number | null
          document_name: string | null
          document_number: string | null
          document_type: string | null
          expires_at: string | null
          expiry_alert_sent_14d: boolean | null
          expiry_alert_sent_30d: boolean | null
          expiry_alert_sent_7d: boolean | null
          id: string | null
          is_expired: boolean | null
          provider_id: string | null
          status: Database["public"]["Enums"]["document_status"] | null
          urgency_level: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_documents_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_documents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      security_medical_summary: {
        Row: {
          condition_name: string | null
          condition_type:
            | Database["public"]["Enums"]["medical_condition_type"]
            | null
          emergency_instructions: string | null
          evacuation_notes: string | null
          full_name: string | null
          need_type:
            | Database["public"]["Enums"]["accessibility_need_type"]
            | null
          needs_evacuation_assistance: boolean | null
          resident_id: string | null
          severity: Database["public"]["Enums"]["medical_severity"] | null
          unit_number: string | null
        }
        Relationships: []
      }
      unit_balances: {
        Row: {
          building: string | null
          coefficient: number | null
          community_id: string | null
          days_overdue: number | null
          floor_number: number | null
          last_charge_date: string | null
          last_payment_date: string | null
          oldest_unpaid_date: string | null
          total_charges: number | null
          total_interest: number | null
          total_payments: number | null
          total_receivable: number | null
          unit_id: string | null
          unit_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_delivery_stats: {
        Row: {
          avg_delivery_seconds: number | null
          community_id: string | null
          consecutive_failures: number | null
          dead_letter_count: number | null
          delivered_count: number | null
          endpoint_id: string | null
          endpoint_name: string | null
          failed_count: number | null
          is_active: boolean | null
          is_auto_disabled: boolean | null
          last_delivered_at: string | null
          pending_count: number | null
          retrying_count: number | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_incident_comment: {
        Args: {
          p_actor_id?: string
          p_incident_id: string
          p_is_internal?: boolean
          p_text: string
        }
        Returns: string
      }
      add_incident_event: {
        Args: {
          p_actor_id?: string
          p_data?: Json
          p_event_type: string
          p_incident_id: string
        }
        Returns: string
      }
      add_to_waitlist: {
        Args: {
          p_amenity_id: string
          p_end_time: string
          p_expires_hours?: number
          p_resident_id: string
          p_start_time: string
          p_unit_id: string
        }
        Returns: string
      }
      advance_convocatoria: {
        Args: { p_assembly_id: string }
        Returns: Database["public"]["Enums"]["assembly_status"]
      }
      approve_deposit_refund: {
        Args: { p_deposit_id: string }
        Returns: {
          amount: number
          collected_at: string
          collected_by: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deduction_amount: number | null
          deduction_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_type: string
          id: string
          inspection_date: string | null
          inspection_notes: string | null
          inspection_photos: string[] | null
          move_request_id: string | null
          payment_method: string | null
          receipt_number: string | null
          refund_amount: number | null
          refund_approved_at: string | null
          refund_approved_by: string | null
          refund_method: string | null
          refund_processed_at: string | null
          refund_reference: string | null
          resident_id: string
          status: Database["public"]["Enums"]["deposit_status"]
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "move_deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_device: {
        Args: {
          p_collect_deposit?: boolean
          p_device_id: string
          p_guard_id?: string
          p_provider_personnel_id?: string
          p_resident_id?: string
          p_unit_id?: string
        }
        Returns: string
      }
      assign_role: {
        Args: {
          p_community_id: string
          p_role_id: string
          p_user_id: string
          p_valid_until?: string
        }
        Returns: string
      }
      backfill_kpis: {
        Args: {
          p_community_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: number
      }
      burn_qr_code: {
        Args: {
          p_access_point_id?: string
          p_guard_id?: string
          p_qr_id: string
        }
        Returns: boolean
      }
      calculate_assembly_quorum: {
        Args: { p_assembly_id: string }
        Returns: {
          percentage: number
          present_coefficient: number
          quorum_met: boolean
          required_for_convocatoria_1: boolean
          required_for_convocatoria_2: boolean
          required_for_convocatoria_3: boolean
          total_coefficient: number
        }[]
      }
      calculate_fee_amount: {
        Args: { p_fee_structure_id: string; p_unit_id: string }
        Returns: unknown
      }
      calculate_gps_distance_meters: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      calculate_next_retry: { Args: { p_attempt: number }; Returns: unknown }
      cancel_parking_reservation: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      capture_signature: {
        Args: {
          p_browser?: string
          p_consent_checkbox_id?: string
          p_consent_text: string
          p_device_id?: string
          p_device_model?: string
          p_device_type?: string
          p_document_id: string
          p_document_version_id: string
          p_ip_address: unknown
          p_latitude?: number
          p_location_accuracy_meters?: number
          p_longitude?: number
          p_os?: string
          p_screen_resolution?: string
          p_signature_data: string
          p_signature_type: string
          p_user_agent: string
        }
        Returns: string
      }
      cast_vote: {
        Args: {
          p_election_id: string
          p_is_proxy?: boolean
          p_proxy_document?: string
          p_proxy_for?: string
          p_selected_options: string[]
          p_unit_id: string
        }
        Returns: string
      }
      charge_no_show_fee: {
        Args: { p_penalty_amount?: unknown; p_reservation_id: string }
        Returns: string
      }
      charge_reservation_deposit: {
        Args: { p_reservation_id: string }
        Returns: string
      }
      charge_reservation_usage: {
        Args: { p_reservation_id: string }
        Returns: string
      }
      check_debt_free: { Args: { p_unit_id: string }; Returns: boolean }
      check_document_access: {
        Args: {
          p_document_id: string
          p_permission?: string
          p_user_id: string
        }
        Returns: boolean
      }
      check_election_quorum: {
        Args: { p_election_id: string }
        Returns: boolean
      }
      check_escalation_triggers: {
        Args: never
        Returns: {
          action_target: string
          action_type: string
          notification_template: string
          rule_id: string
          ticket_id: string
          trigger_type: string
        }[]
      }
      check_sla_breaches: {
        Args: never
        Returns: {
          breach_type: string
          community_id: string
          escalate_to: string
          ticket_id: string
        }[]
      }
      checkin_parking_visitor: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      checkout_attendance: {
        Args: { p_assembly_id: string; p_unit_id: string }
        Returns: boolean
      }
      checkout_parking_visitor: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      claim_moderation_item: {
        Args: { p_community_id: string }
        Returns: {
          item_id: string
          item_type: string
          queue_id: string
        }[]
      }
      complete_admin_onboarding: {
        Args: {
          p_community_address?: string
          p_community_city?: string
          p_community_name: string
          p_community_state?: string
          p_community_zip?: string
          p_first_name?: string
          p_org_name: string
          p_paternal_surname?: string
        }
        Returns: Json
      }
      complete_deposit_refund: {
        Args: { p_deposit_id: string; p_method: string; p_reference: string }
        Returns: {
          amount: number
          collected_at: string
          collected_by: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deduction_amount: number | null
          deduction_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_type: string
          id: string
          inspection_date: string | null
          inspection_notes: string | null
          inspection_photos: string[] | null
          move_request_id: string | null
          payment_method: string | null
          receipt_number: string | null
          refund_amount: number | null
          refund_approved_at: string | null
          refund_approved_by: string | null
          refund_method: string | null
          refund_processed_at: string | null
          refund_reference: string | null
          resident_id: string
          status: Database["public"]["Enums"]["deposit_status"]
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "move_deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_all_daily_kpis: { Args: { p_date: string }; Returns: number }
      compute_all_monthly_kpis: {
        Args: { p_month: number; p_year: number }
        Returns: number
      }
      compute_all_weekly_kpis: {
        Args: { p_week_start: string }
        Returns: number
      }
      compute_daily_kpis: {
        Args: { p_community_id: string; p_date: string }
        Returns: string
      }
      compute_monthly_kpis: {
        Args: { p_community_id: string; p_month: number; p_year: number }
        Returns: string
      }
      compute_next_rrule_occurrence: {
        Args: { p_after: string; p_dtstart: string; p_rrule: string }
        Returns: string
      }
      compute_package_signature_hash: {
        Args: {
          p_ip_address: unknown
          p_package_id: string
          p_signed_at: string
          p_signed_by_name: string
        }
        Returns: string
      }
      compute_signature_hash: {
        Args: {
          p_document_checksum: string
          p_ip_address: unknown
          p_resident_id: string
          p_signed_at: string
        }
        Returns: string
      }
      compute_sla_due_dates: {
        Args: {
          p_category_id: string
          p_community_id: string
          p_created_at?: string
          p_priority: Database["public"]["Enums"]["ticket_priority"]
        }
        Returns: {
          resolution_due: string
          response_due: string
        }[]
      }
      compute_weekly_kpis: {
        Args: { p_community_id: string; p_week_start: string }
        Returns: string
      }
      confirm_exchange_completion: {
        Args: { p_appointment_id: string; p_role: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      create_default_amenity_rules: {
        Args: { p_amenity_id: string }
        Returns: undefined
      }
      create_default_channels: {
        Args: { p_community_id: string }
        Returns: undefined
      }
      create_default_community_settings: {
        Args: { p_community_id: string }
        Returns: string
      }
      create_default_exchange_zones: {
        Args: { p_community_id: string }
        Returns: number
      }
      create_default_payment_methods: {
        Args: { p_community_id: string }
        Returns: number
      }
      create_parking_reservation: {
        Args: {
          p_date: string
          p_end: string
          p_notes?: string
          p_resident_id: string
          p_spot_id: string
          p_start: string
          p_unit_id: string
          p_visitor_name: string
          p_visitor_phone?: string
          p_visitor_plates?: string
          p_visitor_vehicle?: string
        }
        Returns: string
      }
      create_pickup_code: {
        Args: {
          p_code_type?: Database["public"]["Enums"]["pickup_code_type"]
          p_package_id: string
          p_valid_hours?: number
        }
        Returns: string
      }
      create_reservation: {
        Args: {
          p_amenity_id: string
          p_end_time: string
          p_notes?: string
          p_resident_id: string
          p_start_time: string
          p_unit_id: string
        }
        Returns: string
      }
      create_standard_chart_of_accounts: {
        Args: { p_community_id: string }
        Returns: number
      }
      create_user_session: {
        Args: { p_device_info?: Json; p_ip_address: unknown; p_user_id: string }
        Returns: string
      }
      create_group_conversation: {
        Args: {
          p_community_id: string
          p_name: string
          p_description?: string | null
          p_member_user_ids?: string[]
        }
        Returns: string
      }
      deactivate_device: {
        Args: { p_device_id: string; p_reason: string }
        Returns: undefined
      }
      delete_message: { Args: { p_message_id: string }; Returns: boolean }
      delete_own_account: { Args: never; Returns: undefined }
      edit_message: {
        Args: { p_message_id: string; p_new_content: string }
        Returns: {
          content: string | null
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean
          is_edited: boolean
          media_types: string[] | null
          media_urls: string[] | null
          message_type: string
          original_content: string | null
          reply_to_message_id: string | null
          sender_id: string
          system_data: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      escalate_incident: {
        Args: {
          p_incident_id: string
          p_new_priority: number
          p_reason?: string
        }
        Returns: undefined
      }
      execute_escalation: {
        Args: { p_rule_id: string; p_ticket_id: string }
        Returns: string
      }
      expand_announcement_recipients: {
        Args: { p_announcement_id: string }
        Returns: number
      }
      find_or_create_direct_conversation: {
        Args: { p_community_id: string; p_user_id1: string; p_user_id2: string }
        Returns: string
      }
      forfeit_deposit: {
        Args: { p_deposit_id: string; p_reason: string }
        Returns: {
          amount: number
          collected_at: string
          collected_by: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deduction_amount: number | null
          deduction_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_type: string
          id: string
          inspection_date: string | null
          inspection_notes: string | null
          inspection_photos: string[] | null
          move_request_id: string | null
          payment_method: string | null
          receipt_number: string | null
          refund_amount: number | null
          refund_approved_at: string | null
          refund_approved_by: string | null
          refund_method: string | null
          refund_processed_at: string | null
          refund_reference: string | null
          resident_id: string
          status: Database["public"]["Enums"]["deposit_status"]
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "move_deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_assembly_number: {
        Args: { p_community_id: string }
        Returns: string
      }
      generate_election_number: {
        Args: { p_community_id: string }
        Returns: string
      }
      generate_incident_number: {
        Args: { p_community_id: string; p_date?: string }
        Returns: string
      }
      generate_pickup_pin: { Args: never; Returns: string }
      generate_pickup_qr_payload: {
        Args: {
          p_expires_at: string
          p_package_id: string
          p_secret_key: string
        }
        Returns: string
      }
      generate_preventive_tickets: { Args: never; Returns: number }
      generate_qr_payload: {
        Args: {
          comm_id: string
          expires_at: string
          qr_id: string
          secret_key: string
        }
        Returns: string
      }
      generate_uuid_v7: { Args: never; Returns: string }
      generate_violation_number: {
        Args: { p_community_id: string }
        Returns: string
      }
      generate_work_order_number: {
        Args: { p_community_id: string }
        Returns: string
      }
      get_accessible_documents: {
        Args: { p_user_id: string }
        Returns: {
          access_source: string
          category: Database["public"]["Enums"]["document_category"]
          current_version_id: string
          description: string
          document_id: string
          is_public: boolean
          name: string
          requires_signature: boolean
        }[]
      }
      get_assembly_summary: {
        Args: { p_assembly_id: string }
        Returns: {
          agreements_approved: number
          agreements_count: number
          assembly_id: string
          assembly_number: string
          assembly_type: Database["public"]["Enums"]["assembly_type"]
          present_coefficient: number
          quorum_met: boolean
          quorum_percentage: number
          scheduled_date: string
          scheduled_time: string
          status: Database["public"]["Enums"]["assembly_status"]
          title: string
          total_coefficient: number
          total_units: number
          units_present: number
        }[]
      }
      get_available_parking_spots: {
        Args: {
          p_community_id: string
          p_spot_type?: Database["public"]["Enums"]["parking_spot_type"]
        }
        Returns: {
          area: string
          is_covered: boolean
          is_electric_vehicle: boolean
          monthly_fee: unknown
          spot_id: string
          spot_number: string
          spot_type: Database["public"]["Enums"]["parking_spot_type"]
        }[]
      }
      get_bytea_to_byte: { Args: { b: string; pos: number }; Returns: string }
      get_comment_thread: {
        Args: { p_post_id: string }
        Returns: {
          author_id: string
          content: string
          created_at: string
          depth: number
          id: string
          is_hidden: boolean
          parent_comment_id: string
          path: string[]
          root_comment_id: string
          updated_at: string
        }[]
      }
      get_community_receivable_summary: {
        Args: { p_community_id: string }
        Returns: {
          average_days_overdue: number
          total_receivable: number
          units_delinquent_30: number
          units_delinquent_60: number
          units_delinquent_90: number
          units_with_balance: number
        }[]
      }
      get_conversation_list: {
        Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
        Returns: {
          avatar_url: string
          conversation_id: string
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at: string
          description: string
          is_archived: boolean
          is_muted: boolean
          last_message_at: string
          last_message_preview: string
          message_count: number
          name: string
          other_participant_name: string
          other_participant_user_id: string
          participant_count: number
          unread_count: number
        }[]
      }
      get_current_community_id: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_delinquent_units: {
        Args: {
          p_community_id: string
          p_min_amount?: number
          p_min_days?: number
        }
        Returns: {
          building: string
          days_overdue: number
          last_payment_date: string
          oldest_unpaid_date: string
          total_receivable: number
          unit_id: string
          unit_number: string
        }[]
      }
      get_document_history: {
        Args: { p_document_id: string }
        Returns: {
          change_summary: string
          checksum: string
          created_at: string
          file_name: string
          file_size_bytes: number
          mime_type: string
          previous_version_id: string
          uploaded_by: string
          uploader_email: string
          version_id: string
          version_number: number
        }[]
      }
      get_document_signatures: {
        Args: { p_document_id: string }
        Returns: {
          device_type: string
          ip_address: unknown
          resident_id: string
          resident_name: string
          signature_id: string
          signature_type: string
          signature_verified: boolean
          signed_at: string
          unit_identifier: string
        }[]
      }
      get_election_results: {
        Args: { p_election_id: string }
        Returns: {
          coefficient_total: number
          option_id: string
          percentage: number
          title: string
          votes_count: number
        }[]
      }
      get_election_summary: {
        Args: { p_election_id: string }
        Returns: {
          election_id: string
          participation_percentage: number
          quorum_met: boolean
          quorum_required: number
          status: Database["public"]["Enums"]["election_status"]
          title: string
          total_coefficient: number
          total_units: number
          voted_coefficient: number
          voted_units: number
        }[]
      }
      get_emergency_contacts: {
        Args: { p_resident_id: string }
        Returns: {
          contact_for: string[]
          contact_name: string
          phone_primary: string
          phone_secondary: string
          priority: number
          relationship: Database["public"]["Enums"]["emergency_contact_relationship"]
        }[]
      }
      get_emergency_contacts_for_unit: {
        Args: { p_unit_id: string }
        Returns: {
          contact_for: string[]
          contact_name: string
          phone_primary: string
          phone_secondary: string
          priority: number
          relationship: Database["public"]["Enums"]["emergency_contact_relationship"]
          resident_id: string
          resident_name: string
        }[]
      }
      get_emergency_sla_metrics: {
        Args: { p_emergency_id: string }
        Returns: {
          time_to_acknowledge: unknown
          time_to_arrive: unknown
          time_to_resolve: unknown
          time_to_respond: unknown
        }[]
      }
      get_evacuation_priority_list: {
        Args: { p_community_id: string }
        Returns: {
          evacuation_notes: string
          floor_number: number
          mobility_device_type: Database["public"]["Enums"]["mobility_device_type"]
          need_type: Database["public"]["Enums"]["accessibility_need_type"]
          needs_evacuation_assistance: boolean
          resident_id: string
          resident_name: string
          unit_id: string
          unit_number: string
          uses_mobility_device: boolean
        }[]
      }
      get_feature_config: {
        Args: { p_community_id: string; p_feature_name: string }
        Returns: Json
      }
      get_guards_on_duty: {
        Args: { p_access_point_id: string; p_check_time?: string }
        Returns: {
          community_id: string
          created_at: string
          curp: string | null
          deleted_at: string | null
          email: string | null
          employee_number: string | null
          employment_status: Database["public"]["Enums"]["general_status"]
          first_name: string
          full_name: string | null
          hired_at: string | null
          id: string
          ine_number: string | null
          maternal_surname: string | null
          paternal_surname: string
          phone: string
          phone_emergency: string | null
          photo_url: string | null
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "guards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_next_waitlist_position: {
        Args: { p_amenity_id: string; p_date: string }
        Returns: number
      }
      get_or_create_guard_booth: {
        Args: {
          p_access_point_id: string
          p_community_id: string
          p_guard_id: string
          p_shift_date: string
        }
        Returns: string
      }
      get_pending_kpi_dates: {
        Args: { p_community_id: string; p_days_back?: number }
        Returns: {
          has_data: boolean
          missing_date: string
        }[]
      }
      get_pending_signatures: {
        Args: { p_resident_id: string }
        Returns: {
          category: Database["public"]["Enums"]["document_category"]
          current_version_id: string
          days_until_deadline: number
          document_id: string
          document_name: string
          signature_deadline: string
        }[]
      }
      get_pending_webhooks: {
        Args: { p_limit?: number }
        Returns: {
          custom_headers: Json
          delivery_id: string
          endpoint_url: string
          event_type: string
          payload: Json
          signature: string
        }[]
      }
      get_todays_parking_reservations: {
        Args: { p_community_id: string }
        Returns: {
          checked_in_at: string
          end_time: string
          reservation_id: string
          spot_number: string
          start_time: string
          status: Database["public"]["Enums"]["parking_reservation_status"]
          unit_number: string
          visitor_name: string
          visitor_plates: string
        }[]
      }
      get_unit_balance: {
        Args: { p_unit_id: string }
        Returns: {
          current_balance: number
          days_overdue: number
          last_charge_date: string
          last_payment_date: string
          total_charges: number
          total_payments: number
        }[]
      }
      get_unit_fee_amount: {
        Args: {
          p_as_of_date?: string
          p_fee_structure_id: string
          p_unit_id: string
        }
        Returns: unknown
      }
      get_unit_parking_spots: {
        Args: { p_unit_id: string }
        Returns: {
          area: string
          assignment_type: Database["public"]["Enums"]["parking_assignment_type"]
          is_covered: boolean
          spot_id: string
          spot_number: string
          spot_type: Database["public"]["Enums"]["parking_spot_type"]
          vehicle_plates: string
        }[]
      }
      get_unread_conversations_count: {
        Args: { p_user_id?: string }
        Returns: number
      }
      get_user_permissions: {
        Args: { p_community_id?: string; p_user_id?: string }
        Returns: {
          action: string
          conditions: Json
          permission_name: string
          resource: string
        }[]
      }
      get_user_roles: {
        Args: { p_community_id?: string; p_user_id?: string }
        Returns: {
          assigned_at: string
          display_name: string
          is_system_role: boolean
          role_id: string
          role_name: string
          valid_until: string
        }[]
      }
      get_violation_history: {
        Args: { p_months?: number; p_unit_id: string }
        Returns: {
          appeal_status: string
          occurred_at: string
          offense_number: number
          sanction_types: string[]
          severity: Database["public"]["Enums"]["violation_severity"]
          status: string
          total_fines: unknown
          violation_id: string
          violation_number: string
          violation_type_category: string
          violation_type_name: string
        }[]
      }
      has_permission: {
        Args: {
          p_community_id: string
          p_permission_name: string
          p_user_id: string
        }
        Returns: boolean
      }
      increment_listing_inquiry_count: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      increment_listing_view_count: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      increment_post_view_count: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      is_amenity_open: {
        Args: { p_amenity_id: string; p_check_time?: string }
        Returns: boolean
      }
      is_blacklisted: {
        Args: {
          p_community_id: string
          p_person_document?: string
          p_person_name?: string
          p_plate_normalized?: string
        }
        Returns: {
          blacklist_id: string
          is_blocked: boolean
          protocol: string
          reason: string
        }[]
      }
      is_feature_enabled: {
        Args: { p_community_id: string; p_feature_name: string }
        Returns: boolean
      }
      is_invitation_valid: {
        Args: { check_time?: string; inv_id: string }
        Returns: boolean
      }
      is_parking_available: {
        Args: {
          p_date: string
          p_end: string
          p_spot_id: string
          p_start: string
        }
        Returns: boolean
      }
      is_provider_access_allowed: {
        Args: { p_check_time?: string; p_provider_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      issue_sanction: {
        Args: {
          p_description: string
          p_fine_amount?: unknown
          p_issued_by?: string
          p_sanction_type: Database["public"]["Enums"]["sanction_type"]
          p_suspended_amenities?: string[]
          p_suspension_end?: string
          p_suspension_start?: string
          p_violation_id: string
        }
        Returns: string
      }
      log_device_event: {
        Args: {
          p_description: string
          p_device_id: string
          p_event_type: string
          p_metadata?: Json
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          p_community_id?: string
          p_description: string
          p_entity_id?: string
          p_entity_type?: string
          p_event_type: Database["public"]["Enums"]["security_event_type"]
          p_metadata?: Json
          p_session_id?: string
          p_severity?: string
          p_user_id?: string
        }
        Returns: string
      }
      mark_messages_read: {
        Args: {
          p_conversation_id: string
          p_up_to_message_id: string
          p_user_id: string
        }
        Returns: number
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      notify_typing: { Args: { p_conversation_id: string }; Returns: undefined }
      perform_soft_delete: {
        Args: { record_id: string; table_name: string }
        Returns: boolean
      }
      process_deposit_refund: {
        Args: {
          p_deduction_amount: number
          p_deposit_id: string
          p_reason: string
        }
        Returns: {
          amount: number
          collected_at: string
          collected_by: string | null
          community_id: string
          created_at: string
          created_by: string | null
          deduction_amount: number | null
          deduction_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_type: string
          id: string
          inspection_date: string | null
          inspection_notes: string | null
          inspection_photos: string[] | null
          move_request_id: string | null
          payment_method: string | null
          receipt_number: string | null
          refund_amount: number | null
          refund_approved_at: string | null
          refund_approved_by: string | null
          refund_method: string | null
          refund_processed_at: string | null
          refund_reference: string | null
          resident_id: string
          status: Database["public"]["Enums"]["deposit_status"]
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "move_deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_escalations: { Args: never; Returns: number }
      process_webhook_delivery: {
        Args: { p_delivery_id: string }
        Returns: boolean
      }
      queue_webhook: {
        Args: {
          p_community_id: string
          p_event_id: string
          p_event_type: string
          p_payload: Json
        }
        Returns: string[]
      }
      reactivate_device: { Args: { p_device_id: string }; Returns: undefined }
      record_agreement: {
        Args: {
          p_abstentions?: number
          p_approved?: boolean
          p_assembly_id: string
          p_description: string
          p_election_id?: string
          p_title: string
          p_votes_against?: number
          p_votes_for?: number
        }
        Returns: string
      }
      record_attendance: {
        Args: {
          p_assembly_id: string
          p_attendee_name?: string
          p_attendee_type: Database["public"]["Enums"]["attendance_type"]
          p_is_proxy?: boolean
          p_proxy_document_url?: string
          p_proxy_grantor_id?: string
          p_resident_id?: string
          p_unit_id: string
        }
        Returns: string
      }
      record_charge: {
        Args: {
          p_amount: number
          p_charge_date: string
          p_community_id: string
          p_created_by: string
          p_description: string
          p_fee_structure_id: string
          p_unit_id: string
        }
        Returns: string
      }
      record_notification_action: {
        Args: { p_action: string; p_notification_id: string }
        Returns: boolean
      }
      record_webhook_result: {
        Args: {
          p_delivery_id: string
          p_error?: string
          p_response_body?: string
          p_response_code?: number
          p_success: boolean
        }
        Returns: undefined
      }
      refresh_kpis: {
        Args: { p_community_id: string; p_days_back?: number }
        Returns: {
          dates_processed: number
          months_processed: number
          weeks_processed: number
        }[]
      }
      refund_reservation_deposit: {
        Args: { p_refund_reason?: string; p_reservation_id: string }
        Returns: string
      }
      release_stale_claims: {
        Args: { p_timeout_minutes?: number }
        Returns: number
      }
      report_device_lost: {
        Args: { p_device_id: string; p_notes?: string }
        Returns: undefined
      }
      report_parking_violation: {
        Args: {
          p_community_id: string
          p_description?: string
          p_location?: string
          p_photo_urls?: string[]
          p_plates?: string
          p_spot_id?: string
          p_vehicle_description?: string
          p_violation_type?: Database["public"]["Enums"]["parking_violation_type"]
        }
        Returns: string
      }
      resolve_moderation: {
        Args: { p_notes?: string; p_queue_id: string; p_resolution: string }
        Returns: boolean
      }
      retry_dead_letter: { Args: { p_delivery_id: string }; Returns: boolean }
      return_device: {
        Args: { p_assignment_id: string; p_condition: string; p_notes?: string }
        Returns: undefined
      }
      revoke_role: {
        Args: { p_community_id: string; p_role_id: string; p_user_id: string }
        Returns: boolean
      }
      search_messages: {
        Args: { p_limit?: number; p_query?: string; p_user_id?: string }
        Returns: {
          content: string
          content_highlight: string
          conversation_id: string
          conversation_name: string
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at: string
          message_id: string
          sender_id: string
          sender_name: string
        }[]
      }
      send_service_notification: {
        Args: {
          p_body: string
          p_expires_at?: string
          p_notification_type: Database["public"]["Enums"]["notification_type_service"]
          p_related_entity_id?: string
          p_related_entity_type?: string
          p_title: string
          p_unit_id: string
        }
        Returns: string[]
      }
      should_block_login: {
        Args: {
          p_email: string
          p_ip_address: unknown
          p_max_attempts?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      terminate_session: {
        Args: { p_reason: string; p_session_id: string }
        Returns: undefined
      }
      update_session_activity: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      upload_document_version: {
        Args: {
          p_change_summary?: string
          p_checksum?: string
          p_document_id: string
          p_file_name: string
          p_file_size: number
          p_mime_type: string
          p_storage_path: string
        }
        Returns: {
          change_summary: string | null
          checksum: string | null
          created_at: string
          document_id: string
          file_name: string
          file_size_bytes: number | null
          id: string
          mime_type: string
          previous_version_id: string | null
          storage_bucket: string
          storage_path: string
          uploaded_by: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "document_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      use_pickup_code: {
        Args: { p_code_id: string; p_used_by?: string }
        Returns: boolean
      }
      user_has_community_access: {
        Args: { target_community_id: string }
        Returns: boolean
      }
      validate_booking_rules: {
        Args: {
          p_amenity_id: string
          p_end_time: string
          p_start_time: string
          p_unit_id: string
        }
        Returns: {
          is_valid: boolean
          message: string
          violated_rule: string
        }[]
      }
      validate_pickup_code: {
        Args: { p_code_value: string; p_package_id: string }
        Returns: {
          code_id: string
          error_message: string
          is_valid: boolean
        }[]
      }
      verify_pickup_qr_payload: {
        Args: { p_payload: string; p_secret_key: string }
        Returns: {
          error_message: string
          expires_at: string
          is_valid: boolean
          package_id: string
        }[]
      }
      verify_qr_payload: {
        Args: { payload: string; secret_key: string }
        Returns: {
          community_id: string
          error_message: string
          expires_at: string
          is_valid: boolean
          qr_id: string
        }[]
      }
      verify_signature_hash: {
        Args: { p_signature_id: string }
        Returns: boolean
      }
      vote_on_poll: {
        Args: { p_option_index: number; p_post_id: string }
        Returns: Json
      }
    }
    Enums: {
      access_decision: "allowed" | "pending" | "denied" | "blocked"
      access_point_direction: "entry" | "exit" | "bidirectional"
      access_point_type:
        | "vehicular_gate"
        | "pedestrian_gate"
        | "turnstile"
        | "barrier"
        | "door"
        | "elevator"
      accessibility_need_type:
        | "wheelchair"
        | "visual"
        | "hearing"
        | "cognitive"
        | "mobility"
        | "respiratory"
        | "other"
      account_category: "asset" | "liability" | "equity" | "income" | "expense"
      account_subtype:
        | "cash"
        | "accounts_receivable"
        | "prepaid"
        | "fixed_asset"
        | "accounts_payable"
        | "security_deposits"
        | "loans"
        | "deferred_income"
        | "retained_earnings"
        | "reserves"
        | "maintenance_fees"
        | "special_assessments"
        | "late_fees"
        | "other_income"
        | "utilities"
        | "maintenance"
        | "administrative"
        | "insurance"
        | "taxes"
        | "reserve_contribution"
      amenity_type:
        | "pool"
        | "gym"
        | "salon"
        | "rooftop"
        | "bbq"
        | "court"
        | "room"
        | "parking"
        | "other"
      announcement_segment:
        | "all"
        | "owners"
        | "tenants"
        | "building"
        | "unit_type"
        | "delinquent"
        | "role"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "expired"
      assembly_status:
        | "scheduled"
        | "convocatoria_1"
        | "convocatoria_2"
        | "convocatoria_3"
        | "in_progress"
        | "concluded"
        | "cancelled"
      assembly_type: "ordinary" | "extraordinary"
      asset_status:
        | "operational"
        | "degraded"
        | "maintenance"
        | "out_of_service"
        | "retired"
      attendance_type: "owner" | "representative" | "proxy"
      budget_status: "draft" | "approved" | "active" | "closed"
      channel_type:
        | "general"
        | "building"
        | "committee"
        | "announcements"
        | "marketplace"
      conversation_type: "direct" | "group" | "guard_booth" | "support"
      delinquency_action_type:
        | "reminder_email"
        | "reminder_sms"
        | "late_fee"
        | "interest_charge"
        | "service_restriction"
        | "payment_plan_offer"
        | "legal_warning"
        | "collection_referral"
        | "service_suspension"
      deposit_status:
        | "collected"
        | "held"
        | "inspection_pending"
        | "deductions_pending"
        | "refund_pending"
        | "refunded"
        | "forfeited"
      device_status:
        | "in_inventory"
        | "assigned"
        | "lost"
        | "damaged"
        | "deactivated"
        | "retired"
      device_type:
        | "rfid_tag"
        | "rfid_card"
        | "remote"
        | "physical_key"
        | "transponder"
        | "biometric"
      document_category:
        | "legal"
        | "assembly"
        | "financial"
        | "operational"
        | "communication"
      document_status:
        | "pending_verification"
        | "verified"
        | "expired"
        | "rejected"
      document_type:
        | "ine_front"
        | "ine_back"
        | "proof_of_address"
        | "lease_contract"
        | "property_deed"
        | "power_of_attorney"
        | "vehicle_registration"
        | "pet_vaccination"
        | "other"
      election_status:
        | "draft"
        | "scheduled"
        | "open"
        | "closed"
        | "certified"
        | "cancelled"
      election_type:
        | "board_election"
        | "bylaw_amendment"
        | "extraordinary_expense"
        | "general_decision"
      emergency_contact_relationship:
        | "spouse"
        | "parent"
        | "child"
        | "sibling"
        | "friend"
        | "doctor"
        | "employer"
        | "neighbor"
        | "other"
      emergency_status:
        | "triggered"
        | "acknowledged"
        | "responding"
        | "on_scene"
        | "resolved"
        | "false_alarm"
        | "escalated"
      emergency_type:
        | "panic"
        | "medical"
        | "fire"
        | "intrusion"
        | "natural_disaster"
      fee_calculation_type:
        | "fixed"
        | "coefficient"
        | "hybrid"
        | "tiered"
        | "custom"
      fee_frequency:
        | "monthly"
        | "bimonthly"
        | "quarterly"
        | "semiannual"
        | "annual"
        | "one_time"
      fee_type_reservation: "deposit" | "usage" | "no_show" | "cancellation"
      general_status:
        | "active"
        | "inactive"
        | "pending"
        | "archived"
        | "suspended"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status:
        | "reported"
        | "acknowledged"
        | "investigating"
        | "in_progress"
        | "pending_review"
        | "resolved"
        | "closed"
      interest_calculation_method:
        | "simple"
        | "compound_monthly"
        | "compound_daily"
        | "flat_fee"
      invitation_type: "single_use" | "event" | "recurring" | "vehicle_preauth"
      listing_category: "sale" | "service" | "rental" | "wanted"
      medical_condition_type:
        | "allergy"
        | "chronic_condition"
        | "disability"
        | "medication"
        | "other"
      medical_severity: "mild" | "moderate" | "severe" | "life_threatening"
      mobility_device_type:
        | "wheelchair"
        | "walker"
        | "scooter"
        | "cane"
        | "other"
      moderation_status:
        | "pending"
        | "in_review"
        | "approved"
        | "rejected"
        | "flagged"
      move_status:
        | "requested"
        | "validating"
        | "validation_failed"
        | "approved"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      move_type: "move_in" | "move_out"
      notification_channel: "push" | "email" | "sms" | "in_app"
      notification_type:
        | "ticket_created"
        | "ticket_assigned"
        | "ticket_status_changed"
        | "ticket_comment_added"
        | "sla_warning"
        | "sla_breach"
        | "new_message"
        | "message_reaction"
        | "conversation_mention"
        | "document_published"
        | "signature_required"
        | "signature_reminder"
        | "announcement"
        | "survey_published"
        | "payment_due"
        | "payment_received"
        | "visitor_arrived"
        | "package_arrived"
        | "emergency_alert"
      notification_type_service:
        | "visitor_arrival"
        | "delivery_arrival"
        | "service_provider"
        | "guest_departure"
        | "emergency_alert"
      occupancy_type: "owner" | "tenant" | "authorized" | "employee"
      onboarding_status:
        | "invited"
        | "registered"
        | "verified"
        | "active"
        | "suspended"
        | "inactive"
      package_carrier:
        | "fedex"
        | "dhl"
        | "ups"
        | "estafeta"
        | "redpack"
        | "mercado_libre"
        | "amazon"
        | "correos_mexico"
        | "other"
      package_status:
        | "received"
        | "stored"
        | "notified"
        | "pending_pickup"
        | "picked_up"
        | "forwarded"
        | "returned"
        | "abandoned"
      parking_assignment_type: "ownership" | "rental" | "temporary"
      parking_reservation_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      parking_spot_status:
        | "available"
        | "occupied"
        | "reserved"
        | "maintenance"
        | "blocked"
      parking_spot_type:
        | "assigned"
        | "visitor"
        | "commercial"
        | "disabled"
        | "loading"
        | "reserved"
      parking_violation_status:
        | "reported"
        | "warned"
        | "fined"
        | "resolved"
        | "dismissed"
      parking_violation_type:
        | "unauthorized_parking"
        | "double_parking"
        | "blocking"
        | "overstay"
        | "wrong_spot"
        | "other"
      participant_role: "owner" | "admin" | "member" | "guard"
      pet_species:
        | "dog"
        | "cat"
        | "bird"
        | "fish"
        | "reptile"
        | "rodent"
        | "other"
      pickup_code_status: "active" | "used" | "expired" | "revoked"
      pickup_code_type: "pin" | "qr"
      post_type: "discussion" | "question" | "event" | "poll"
      priority_level: "low" | "medium" | "high" | "urgent" | "critical"
      provider_status: "pending_approval" | "active" | "suspended" | "inactive"
      push_platform: "fcm_android" | "fcm_ios" | "apns" | "web_push"
      qr_status: "active" | "used" | "expired" | "revoked"
      reservation_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      rule_type:
        | "max_per_day"
        | "max_per_week"
        | "max_per_month"
        | "advance_min"
        | "advance_max"
        | "duration_min"
        | "duration_max"
        | "blackout"
        | "require_deposit"
        | "owner_only"
      sanction_type:
        | "verbal_warning"
        | "written_warning"
        | "fine"
        | "amenity_suspension"
        | "access_restriction"
        | "legal_action"
      security_event_type:
        | "login_success"
        | "login_failed"
        | "logout"
        | "password_changed"
        | "mfa_enabled"
        | "mfa_disabled"
        | "session_terminated"
        | "access_blocked"
        | "blacklist_hit"
        | "suspicious_activity"
        | "permission_denied"
        | "data_export"
      statement_line_status:
        | "unmatched"
        | "matched"
        | "manually_matched"
        | "excluded"
        | "disputed"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "pending_parts"
        | "pending_resident"
        | "resolved"
        | "closed"
        | "cancelled"
      transaction_status: "pending" | "posted" | "voided"
      transaction_type:
        | "charge"
        | "payment"
        | "adjustment"
        | "interest"
        | "reversal"
        | "transfer"
      unit_type:
        | "casa"
        | "departamento"
        | "local"
        | "bodega"
        | "oficina"
        | "terreno"
        | "estacionamiento"
      user_role:
        | "super_admin"
        | "admin"
        | "manager"
        | "guard"
        | "resident"
        | "provider"
        | "visitor"
      validation_status: "pending" | "passed" | "failed" | "waived"
      violation_severity: "minor" | "moderate" | "major" | "severe"
      waitlist_status: "waiting" | "promoted" | "expired" | "cancelled"
      webhook_status:
        | "pending"
        | "sending"
        | "delivered"
        | "failed"
        | "retrying"
        | "dead_letter"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_decision: ["allowed", "pending", "denied", "blocked"],
      access_point_direction: ["entry", "exit", "bidirectional"],
      access_point_type: [
        "vehicular_gate",
        "pedestrian_gate",
        "turnstile",
        "barrier",
        "door",
        "elevator",
      ],
      accessibility_need_type: [
        "wheelchair",
        "visual",
        "hearing",
        "cognitive",
        "mobility",
        "respiratory",
        "other",
      ],
      account_category: ["asset", "liability", "equity", "income", "expense"],
      account_subtype: [
        "cash",
        "accounts_receivable",
        "prepaid",
        "fixed_asset",
        "accounts_payable",
        "security_deposits",
        "loans",
        "deferred_income",
        "retained_earnings",
        "reserves",
        "maintenance_fees",
        "special_assessments",
        "late_fees",
        "other_income",
        "utilities",
        "maintenance",
        "administrative",
        "insurance",
        "taxes",
        "reserve_contribution",
      ],
      amenity_type: [
        "pool",
        "gym",
        "salon",
        "rooftop",
        "bbq",
        "court",
        "room",
        "parking",
        "other",
      ],
      announcement_segment: [
        "all",
        "owners",
        "tenants",
        "building",
        "unit_type",
        "delinquent",
        "role",
      ],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "expired",
      ],
      assembly_status: [
        "scheduled",
        "convocatoria_1",
        "convocatoria_2",
        "convocatoria_3",
        "in_progress",
        "concluded",
        "cancelled",
      ],
      assembly_type: ["ordinary", "extraordinary"],
      asset_status: [
        "operational",
        "degraded",
        "maintenance",
        "out_of_service",
        "retired",
      ],
      attendance_type: ["owner", "representative", "proxy"],
      budget_status: ["draft", "approved", "active", "closed"],
      channel_type: [
        "general",
        "building",
        "committee",
        "announcements",
        "marketplace",
      ],
      conversation_type: ["direct", "group", "guard_booth", "support"],
      delinquency_action_type: [
        "reminder_email",
        "reminder_sms",
        "late_fee",
        "interest_charge",
        "service_restriction",
        "payment_plan_offer",
        "legal_warning",
        "collection_referral",
        "service_suspension",
      ],
      deposit_status: [
        "collected",
        "held",
        "inspection_pending",
        "deductions_pending",
        "refund_pending",
        "refunded",
        "forfeited",
      ],
      device_status: [
        "in_inventory",
        "assigned",
        "lost",
        "damaged",
        "deactivated",
        "retired",
      ],
      device_type: [
        "rfid_tag",
        "rfid_card",
        "remote",
        "physical_key",
        "transponder",
        "biometric",
      ],
      document_category: [
        "legal",
        "assembly",
        "financial",
        "operational",
        "communication",
      ],
      document_status: [
        "pending_verification",
        "verified",
        "expired",
        "rejected",
      ],
      document_type: [
        "ine_front",
        "ine_back",
        "proof_of_address",
        "lease_contract",
        "property_deed",
        "power_of_attorney",
        "vehicle_registration",
        "pet_vaccination",
        "other",
      ],
      election_status: [
        "draft",
        "scheduled",
        "open",
        "closed",
        "certified",
        "cancelled",
      ],
      election_type: [
        "board_election",
        "bylaw_amendment",
        "extraordinary_expense",
        "general_decision",
      ],
      emergency_contact_relationship: [
        "spouse",
        "parent",
        "child",
        "sibling",
        "friend",
        "doctor",
        "employer",
        "neighbor",
        "other",
      ],
      emergency_status: [
        "triggered",
        "acknowledged",
        "responding",
        "on_scene",
        "resolved",
        "false_alarm",
        "escalated",
      ],
      emergency_type: [
        "panic",
        "medical",
        "fire",
        "intrusion",
        "natural_disaster",
      ],
      fee_calculation_type: [
        "fixed",
        "coefficient",
        "hybrid",
        "tiered",
        "custom",
      ],
      fee_frequency: [
        "monthly",
        "bimonthly",
        "quarterly",
        "semiannual",
        "annual",
        "one_time",
      ],
      fee_type_reservation: ["deposit", "usage", "no_show", "cancellation"],
      general_status: [
        "active",
        "inactive",
        "pending",
        "archived",
        "suspended",
      ],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: [
        "reported",
        "acknowledged",
        "investigating",
        "in_progress",
        "pending_review",
        "resolved",
        "closed",
      ],
      interest_calculation_method: [
        "simple",
        "compound_monthly",
        "compound_daily",
        "flat_fee",
      ],
      invitation_type: ["single_use", "event", "recurring", "vehicle_preauth"],
      listing_category: ["sale", "service", "rental", "wanted"],
      medical_condition_type: [
        "allergy",
        "chronic_condition",
        "disability",
        "medication",
        "other",
      ],
      medical_severity: ["mild", "moderate", "severe", "life_threatening"],
      mobility_device_type: [
        "wheelchair",
        "walker",
        "scooter",
        "cane",
        "other",
      ],
      moderation_status: [
        "pending",
        "in_review",
        "approved",
        "rejected",
        "flagged",
      ],
      move_status: [
        "requested",
        "validating",
        "validation_failed",
        "approved",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      move_type: ["move_in", "move_out"],
      notification_channel: ["push", "email", "sms", "in_app"],
      notification_type: [
        "ticket_created",
        "ticket_assigned",
        "ticket_status_changed",
        "ticket_comment_added",
        "sla_warning",
        "sla_breach",
        "new_message",
        "message_reaction",
        "conversation_mention",
        "document_published",
        "signature_required",
        "signature_reminder",
        "announcement",
        "survey_published",
        "payment_due",
        "payment_received",
        "visitor_arrived",
        "package_arrived",
        "emergency_alert",
      ],
      notification_type_service: [
        "visitor_arrival",
        "delivery_arrival",
        "service_provider",
        "guest_departure",
        "emergency_alert",
      ],
      occupancy_type: ["owner", "tenant", "authorized", "employee"],
      onboarding_status: [
        "invited",
        "registered",
        "verified",
        "active",
        "suspended",
        "inactive",
      ],
      package_carrier: [
        "fedex",
        "dhl",
        "ups",
        "estafeta",
        "redpack",
        "mercado_libre",
        "amazon",
        "correos_mexico",
        "other",
      ],
      package_status: [
        "received",
        "stored",
        "notified",
        "pending_pickup",
        "picked_up",
        "forwarded",
        "returned",
        "abandoned",
      ],
      parking_assignment_type: ["ownership", "rental", "temporary"],
      parking_reservation_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      parking_spot_status: [
        "available",
        "occupied",
        "reserved",
        "maintenance",
        "blocked",
      ],
      parking_spot_type: [
        "assigned",
        "visitor",
        "commercial",
        "disabled",
        "loading",
        "reserved",
      ],
      parking_violation_status: [
        "reported",
        "warned",
        "fined",
        "resolved",
        "dismissed",
      ],
      parking_violation_type: [
        "unauthorized_parking",
        "double_parking",
        "blocking",
        "overstay",
        "wrong_spot",
        "other",
      ],
      participant_role: ["owner", "admin", "member", "guard"],
      pet_species: ["dog", "cat", "bird", "fish", "reptile", "rodent", "other"],
      pickup_code_status: ["active", "used", "expired", "revoked"],
      pickup_code_type: ["pin", "qr"],
      post_type: ["discussion", "question", "event", "poll"],
      priority_level: ["low", "medium", "high", "urgent", "critical"],
      provider_status: ["pending_approval", "active", "suspended", "inactive"],
      push_platform: ["fcm_android", "fcm_ios", "apns", "web_push"],
      qr_status: ["active", "used", "expired", "revoked"],
      reservation_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      rule_type: [
        "max_per_day",
        "max_per_week",
        "max_per_month",
        "advance_min",
        "advance_max",
        "duration_min",
        "duration_max",
        "blackout",
        "require_deposit",
        "owner_only",
      ],
      sanction_type: [
        "verbal_warning",
        "written_warning",
        "fine",
        "amenity_suspension",
        "access_restriction",
        "legal_action",
      ],
      security_event_type: [
        "login_success",
        "login_failed",
        "logout",
        "password_changed",
        "mfa_enabled",
        "mfa_disabled",
        "session_terminated",
        "access_blocked",
        "blacklist_hit",
        "suspicious_activity",
        "permission_denied",
        "data_export",
      ],
      statement_line_status: [
        "unmatched",
        "matched",
        "manually_matched",
        "excluded",
        "disputed",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "assigned",
        "in_progress",
        "pending_parts",
        "pending_resident",
        "resolved",
        "closed",
        "cancelled",
      ],
      transaction_status: ["pending", "posted", "voided"],
      transaction_type: [
        "charge",
        "payment",
        "adjustment",
        "interest",
        "reversal",
        "transfer",
      ],
      unit_type: [
        "casa",
        "departamento",
        "local",
        "bodega",
        "oficina",
        "terreno",
        "estacionamiento",
      ],
      user_role: [
        "super_admin",
        "admin",
        "manager",
        "guard",
        "resident",
        "provider",
        "visitor",
      ],
      validation_status: ["pending", "passed", "failed", "waived"],
      violation_severity: ["minor", "moderate", "major", "severe"],
      waitlist_status: ["waiting", "promoted", "expired", "cancelled"],
      webhook_status: [
        "pending",
        "sending",
        "delivered",
        "failed",
        "retrying",
        "dead_letter",
      ],
    },
  },
} as const
