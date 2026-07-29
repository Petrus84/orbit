CREATE POLICY anon_read_ig_posts ON orbit.ig_posts
  FOR SELECT
  TO anon, authenticated
  USING (true);
